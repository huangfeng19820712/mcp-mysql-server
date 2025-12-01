import { Pool } from 'mysql2/promise';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';

const logger = pino.default({ level: 'info' }, pino.destination({ dest: 'server.log', mkdir: true }));

export interface QueryArgs {
  sql: string;
  params?: Array<string | number | boolean | null>;
}

export interface ExecuteArgs {
  sql: string;
  params?: Array<string | number | boolean | null>;
}

export interface DescribeTableArgs {
  table: string;
}

export interface HandlerResult {
  content: Array<{ type: 'text'; text: string }>;
}

export interface ShowArgs {
  sql: string;
}

export interface ExplainArgs {
  sql: string;
}

export interface ExplainArgs {
  sql: string;
}

export async function handleQuery(pool: Pool, args: QueryArgs): Promise<HandlerResult> {
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
      error: error instanceof Error ? error.message : String(error)
    });

    throw new McpError(
      ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
    );
  }
}

export async function handleExecute(pool: Pool, args: ExecuteArgs): Promise<HandlerResult> {
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
      error: error instanceof Error ? error.message : String(error)
    });
    throw new McpError(
      ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
    );
  }
}

export async function handleListTables(pool: Pool): Promise<HandlerResult> {
  try {
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
      error: error instanceof Error ? error.message : String(error)
    });
    throw new McpError(
      ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
    );
  }
}

export async function handleDescribeTable(pool: Pool, args: DescribeTableArgs): Promise<HandlerResult> {
  if (!args.table) {
    throw new McpError(ErrorCode.InvalidParams, 'Table name is required');
  }
  try {
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
      error: error instanceof Error ? error.message : String(error)
    });
    throw new McpError(
      ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
    );
  }
}

export async function handleExplain(pool: Pool, args: ExplainArgs): Promise<HandlerResult> {
  if (!args.sql) {
    throw new McpError(ErrorCode.InvalidParams, 'SQL query is required for EXPLAIN');
  }
  try {
    const explainSql = `EXPLAIN ${args.sql}`;
    const [rows] = await pool.query(explainSql);
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
      msg: 'EXPLAIN execution failed',
      sql: args.sql,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new McpError(
      ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
    );
  }
}

export async function handleShowStatement(pool: Pool, args: ShowArgs): Promise<HandlerResult> {
  if (!args.sql || !args.sql.trim().toUpperCase().startsWith('SHOW')) {
    throw new McpError(ErrorCode.InvalidParams, '只允许执行 SHOW 开头的语句');
  }
  try {
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
      msg: 'SHOW 语句执行失败',
      sql: args.sql,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new McpError(
      ErrorCode.InternalError,
        error instanceof Error ? error.message : String(error)
    );
  }
}
