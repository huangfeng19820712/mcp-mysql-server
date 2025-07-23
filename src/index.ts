#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { URL } from 'url';
import pino from 'pino';
import { handleQuery, handleExecute, handleListTables, handleDescribeTable, handleShowStatement, handleExplain, QueryArgs, ExecuteArgs, DescribeTableArgs, ShowArgs, ExplainArgs, HandlerResult } from './handlers.js';
const logger = pino.default({
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: 'server.log', mkdir: true },
        level: 'info',
      },
    ],
  },
});

// Load environment variables
config();


interface DatabaseConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number; // Add optional port parameter
}

// Type guard for error objects
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

// Helper to get error message
function validatePort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}

// Add parseMySQLUrl function after DatabaseConfig interface
function parseMySQLUrl(url: string): DatabaseConfig {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'mysql:') {
      throw new Error('Invalid MySQL URL protocol');
    }

    return {
      host: parsedUrl.hostname,
      user: parsedUrl.username || '',
      password: parsedUrl.password || '',
      database: parsedUrl.pathname.slice(1), // remove leading '/'
      port: parsedUrl.port ? (() => { const p = parseInt(parsedUrl.port, 10); return validatePort(p) ? p : 3306; })() : 3306,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Invalid MySQL URL: ${error.message}`);
    }
    throw new Error('Invalid MySQL URL: Unknown error');
  }
}

class MySQLServer {
  private server: Server;
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'mysql-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Get database URL from command line arguments
    const args = process.argv.slice(2);
    if (args.length > 0) {
      try {
        const databaseUrl = args[0];
        this.config = parseMySQLUrl(databaseUrl);

      } catch (error: unknown) {
        logger.error('Error parsing database URL:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }

    if (process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD && process.env.MYSQL_DATABASE) {
      // Fallback to environment variables if no command line argument is provided
      this.config = {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: process.env.MYSQL_PORT ? (() => { const p = Number(process.env.MYSQL_PORT); return validatePort(p) ? p : 3306; })() : 3306,
      };
    }

    if (!this.config) {
      logger.error('No database configuration provided. Please provide a MySQL URL as a command line argument');
      logger.error('Example: node xxx.js mysql://user:password@localhost:3306/mydb');
      process.exit(1);
    }

    // 初始化连接池
    this.pool = mysql.createPool({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      port: this.config.port,
      waitForConnections: true,
      connectionLimit: Number(process.env.CONNECTION_LIMIT || 10),
      queueLimit: Number(process.env.QUEUE_LIMIT || 0),
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => logger.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
    logger.info('config>' + JSON.stringify({ ...this.config, password: '******' }));
  }

  private async cleanup() {
    if (this.pool) {
      await this.pool.end();
    }
    await this.server.close();
  }

  private async ensureConnection() {
    if (!this.config) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Database configuration not set. Use connect_db tool first.'
      );
    }
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        port: this.config.port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'connect_db',
          description: 'Connect to MySQL database',
          inputSchema: {
            type: 'object',
            properties: {
              host: {
                type: 'string',
                description: 'Database host',
              },
              user: {
                type: 'string',
                description: 'Database user',
              },
              password: {
                type: 'string',
                description: 'Database password',
              },
              database: {
                type: 'string',
                description: 'Database name',
              },
              port: {
                type: 'number',
                description: 'Database port (optional)',
              },
            },
            required: ['host', 'user', 'password', 'database'],
          },
        },
        {
          name: 'query',
          description: 'Execute a SELECT query,can not get table structure,use describe_table tool to get table structure',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SQL SELECT query',
              },
              params: {
                type: 'array',
                items: {
                  type: ['string', 'number', 'boolean', 'null'],
                },
                description: 'Query parameters (optional)',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'execute',
          description: 'Execute an INSERT, UPDATE, or DELETE query',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SQL query (INSERT, UPDATE, DELETE)',
              },
              params: {
                type: 'array',
                items: {
                  type: ['string', 'number', 'boolean', 'null'],
                },
                description: 'Query parameters (optional)',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'list_tables',
          description: 'List all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'describe_table',
          description: 'Get table structure',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'show_statement',
          description: 'Execute a SHOW statement (e.g., SHOW STATUS, SHOW VARIABLES)',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SHOW SQL statement',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'explain',
          description: 'Analyze SQL query performance using EXPLAIN',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'SQL query to analyze with EXPLAIN'
              }
            },
            required: ['sql']
          }
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'connect_db':
          return await this.handleConnectDb(request.params.arguments);
        case 'query':
          return await handleQuery(this.pool!, request.params.arguments as unknown as QueryArgs);
        case 'execute':
          return await handleExecute(this.pool!, request.params.arguments as unknown as ExecuteArgs);
        case 'list_tables':
          return await handleListTables(this.pool!);
        case 'describe_table':
          return await handleDescribeTable(this.pool!, request.params.arguments as unknown as DescribeTableArgs);
        case 'show_statement':
          return await handleShowStatement(this.pool!, request.params.arguments as unknown as ShowArgs);
        case 'explain':
          return await handleExplain(this.pool!, request.params.arguments as unknown as ExplainArgs);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleConnectDb(args: any) {
    let newConfig: DatabaseConfig | null = null;

    // Try to parse from url first
    if (args.url) {
      try {
        newConfig = parseMySQLUrl(args.url);
      } catch (error: unknown) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid MySQL URL: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else if (args.host || args.user || args.password || args.database) {
      // Fall back to individual parameters
      if (!args.host || !args.user || args.password === undefined || args.password === null || !args.database) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Missing required database configuration parameters'
        );
      }
      newConfig = {
        host: args.host,
        user: args.user,
        password: args.password,
        database: args.database,
        port: args.port,
      };
    }

    // If no new config provided, use existing config from env
    if (!newConfig && !this.config) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'No database configuration provided'
      );
    }

    // Close existing connection if any
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    // Update config if new config provided
    if (newConfig) {
      this.config = newConfig;
    }

    try {
      await this.ensureConnection();
      return {
        content: [
          {
            type: 'text',
            text: 'Successfully connected to database',
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to connect to database: ${getErrorMessage(error)}`
      );
    }
  }

  private async handleQuery(args: any) {
    await this.ensureConnection();
    if (!args.sql) {
      throw new McpError(ErrorCode.InvalidParams, 'SQL query is required');
    }
    if (!args.sql.trim().toUpperCase().startsWith('SELECT')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Only SELECT queries are allowed with query tool'
      );
    }
    try {
      const pool = this.pool!;
      const [rows] = await pool.query(args.sql, args.params || []);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'Query execution failed',
        sql: args.sql,
        params: args.params,
        error: getErrorMessage(error)
      });
      throw new McpError(
        ErrorCode.InternalError,
        '数据库查询执行失败，请联系管理员。'
      );
    }
  }

  private async handleExecute(args: any) {
    await this.ensureConnection();
    if (!args.sql) {
      throw new McpError(ErrorCode.InvalidParams, 'SQL query is required');
    }
    const sql = args.sql.trim().toUpperCase();
    if (sql.startsWith('SELECT')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Use query tool for SELECT statements'
      );
    }
    try {
      const pool = this.pool!;
      const [result] = await pool.query(args.sql, args.params || []);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'Execute execution failed',
        sql: args.sql,
        params: args.params,
        error: getErrorMessage(error)
      });
      throw new McpError(
        ErrorCode.InternalError,
        '数据库写入操作失败，请联系管理员。'
      );
    }
  }

  private async handleListTables() {
    await this.ensureConnection();
    try {
      const pool = this.pool!;
      const [rows] = await pool.query('SHOW TABLES');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'List tables failed',
        sql: 'SHOW TABLES',
        error: getErrorMessage(error)
      });
      throw new McpError(
        ErrorCode.InternalError,
        '获取数据表列表失败，请联系管理员。'
      );
    }
  }

  private async handleDescribeTable(args: any) {
    await this.ensureConnection();
    if (!args.table) {
      throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
    }
    try {
      const pool = this.pool!;
      const [rows] = await pool.query('DESCRIBE ??', [args.table]);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'Describe table failed',
        sql: 'DESCRIBE ??',
        params: [args.table],
        error: getErrorMessage(error)
      });
      throw new McpError(
        ErrorCode.InternalError,
        '获取表结构失败，请联系管理员。'
      );
    }
  }

  private async handleShowStatement(args: any) {
    await this.ensureConnection();
    if (!args.sql) {
      throw new McpError(ErrorCode.InvalidParams, 'SQL statement is required');
    }
    try {
      const pool = this.pool!;
      const [rows] = await pool.query(args.sql);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error({
        msg: 'Show statement failed',
        sql: args.sql,
        error: getErrorMessage(error)
      });
      throw new McpError(
        ErrorCode.InternalError,
        '执行 SHOW 语句失败，请联系管理员。'
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MySQL MCP server running on stdio');
  }
}

const server = new MySQLServer();
server.run().catch(console.error);
