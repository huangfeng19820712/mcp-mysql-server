# Node.js开发并发布Model Context Protocol (MCP)服务器到npm及使用指南

## 1. 项目概述

本文将以`mcp-mysql-server`项目为例，详细介绍如何使用Node.js开发Model Context Protocol (MCP)服务器，将其发布到npm registry，并通过`@modelcontextprotocol/inspector`工具进行使用。

MCP服务器允许AI模型通过标准化接口与各种服务和数据源交互，本文中的示例项目实现了与MySQL数据库的交互功能。

## 2. 项目结构准备

### 2.1 创建基础项目结构

```bash
mkdir mcp-mysql-server
cd mcp-mysql-server
npm init -y
```

### 2.2 必要文件配置

创建以下核心文件和目录结构：

```
mcp-mysql-server/
├── src/
│   ├── handlers.ts       # 处理各种MCP工具请求
│   └── index.ts          # MCP服务器入口点
├── tests/
│   └── handlers.test.ts  # 单元测试
├── package.json          # 项目配置和依赖
├── tsconfig.json         # TypeScript配置
├── README.md             # 项目说明文档
└── .gitignore            # Git忽略文件
```

## 3. 核心功能开发

### 3.1 配置package.json

确保package.json包含必要的字段和脚本：

```json
{
  "name": "@yourusername/mcp-mysql-server",
  "version": "1.0.0",
  "description": "MCP Server for MySQL database interaction",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "start": "node dist/index.js",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": ["mcp", "model-context-protocol", "mysql", "database"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "mysql2": "^3.6.5",
    "@modelcontextprotocol/server": "^1.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.6",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "typescript": "^5.3.3"
  }
}
```

### 3.2 实现MCP服务器核心代码

#### src/index.ts

```typescript
import { createMcpServer } from '@modelcontextprotocol/server';
import { handleConnectDb, handleQuery, handleExecute, handleListTables, handleDescribeTable, handleShowStatement, handleExplain } from './handlers';

// 创建MCP服务器实例
const server = createMcpServer({
  name: 'mcp-mysql-server',
  version: '1.0.0',
  description: 'MCP Server for interacting with MySQL databases',
});

// 注册工具
server.registerTool({
  name: 'connect_db',
  description: 'Connect to a MySQL database',
  inputSchema: {
    type: 'object',
    properties: {
      host: { type: 'string' },
      user: { type: 'string' },
      password: { type: 'string' },
      database: { type: 'string' },
      port: { type: 'number', default: 3306 }
    },
    required: ['host', 'user', 'password', 'database']
  },
  handler: handleConnectDb
});

// 注册其他工具...
server.registerTool({
  name: 'query',
  description: 'Execute a SELECT query',
  inputSchema: {
    type: 'object',
    properties: {
      sql: { type: 'string' },
      params: { type: 'array', items: { type: ['string', 'number', 'boolean', 'null'] } }
    },
    required: ['sql']
  },
  handler: handleQuery
});

// 实现其他工具注册...

// 启动服务器
server.start().then(() => {
  console.log('MCP MySQL Server running on port 8080');
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  server.stop().then(() => {
    console.log('Server stopped gracefully');
    process.exit(0);
  });
});
```

#### src/handlers.ts

实现工具处理函数，例如查询处理：

```typescript
import { McpToolHandler } from '@modelcontextprotocol/server';
import { poolMap } from './connection';

export interface QueryArgs {
  sql: string;
  params?: (string | number | boolean | null)[];
}

export const handleQuery: McpToolHandler<QueryArgs> = async (args, context) => {
  const { sql, params = [] } = args;
  const connectionId = context.connectionId;

  if (!connectionId || !poolMap.has(connectionId)) {
    throw new Error('Not connected to database. Call connect_db first.');
  }

  const pool = poolMap.get(connectionId);
  if (!pool) {
    throw new Error('Connection pool not found');
  }

  try {
    const [rows] = await pool.query(sql, params);
    return {
      success: true,
      data: rows
    };
  } catch (error) {
    console.error('Query error:', error);
    throw new Error(`Query failed: ${(error as Error).message}`);
  }
};

// 实现其他工具处理函数...
```

## 4. 测试实现

创建测试文件`tests/handlers.test.ts`：

```typescript
import { handleQuery } from '../src/handlers';
import { poolMap } from '../src/connection';

// Mock the database pool
jest.mock('../src/connection', () => ({
  poolMap: new Map(),
}));

describe('handleQuery', () => {
  it('should execute query successfully', async () => {
    // Setup mock pool
    const mockQuery = jest.fn().mockResolvedValue([[{ id: 1, name: 'test' }]]);
    const mockPool = { query: mockQuery };
    (poolMap as Map<string, any>).set('test-connection', mockPool);

    const result = await handleQuery(
      { sql: 'SELECT * FROM users WHERE id = ?', params: [1] },
      { connectionId: 'test-connection' }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1, name: 'test' }]);
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
  });

  // 更多测试...
});
```

## 5. 准备发布到npm

### 5.1 配置package.json发布信息

确保package.json包含必要的发布字段：

```json
{
  "name": "@yourusername/mcp-mysql-server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist/**/*"],
  "publishConfig": {
    "access": "public"
  },
  // 其他配置...
}
```

### 5.2 创建.npmrc文件

```
//registry.npmjs.org/
access=public
```

### 5.3 创建README.md

包含安装、使用和API文档：

```markdown
# mcp-mysql-server

MCP Server for interacting with MySQL databases. Allows AI models to safely and efficiently interact with MySQL through Model Context Protocol.

## Installation

```bash
npm install @yourusername/mcp-mysql-server
```

## Usage

```javascript
const { startServer } = require('@yourusername/mcp-mysql-server');

startServer({ port: 8080 });
```

## API Documentation

### Tools

- `connect_db`: Establish a connection to MySQL database
- `query`: Execute a SELECT query
- `execute`: Execute INSERT, UPDATE, or DELETE queries
- `list_tables`: List all tables in the database
- `describe_table`: Get table structure
- `show_statement`: Execute SHOW statements
- `explain`: Analyze query performance with EXPLAIN

// 更多文档...
```

## 6. 发布到npm

### 6.1 登录npm

```bash
npm login
```

输入你的npm账号、密码和邮箱。

### 6.2 构建项目

```bash
npm run build
```

### 6.3 版本控制

遵循语义化版本控制：

```bash
# 补丁版本更新 (1.0.0 -> 1.0.1)
npm version patch

# 次要版本更新 (1.0.0 -> 1.1.0)
npm version minor

# 主要版本更新 (1.0.0 -> 2.0.0)
npm version major
```

### 6.4 发布包

```bash
npm publish
```

如果是scoped包且首次发布，可能需要：

```bash
npm publish --access public
```

## 7. 使用@modelcontextprotocol/inspector

### 7.1 安装inspector

```bash
npm install -g @modelcontextprotocol/inspector
```

### 7.2 启动MCP服务器

```bash
cd mcp-mysql-server
npm start
```

### 7.3 运行inspector

```bash
mcp-inspector --server http://localhost:8080
```

### 7.4 使用inspector与MCP服务器交互

1. 在inspector界面中，点击"Connect"按钮
2. 使用`connect_db`工具建立数据库连接：

```json
{
  "host": "localhost",
  "user": "your_db_user",
  "password": "your_db_password",
  "database": "your_database"
}
```

3. 执行查询：

```json
{
  "sql": "SELECT * FROM users WHERE age > ?",
  "params": [18]
}
```

4. 使用`explain`工具分析查询性能：

```json
{
  "sql": "SELECT * FROM users WHERE age > ?",
  "params": [18]
}
```

## 8. 维护和更新

### 8.1 发布更新

```bash
# 修改代码...
npm run test
npm version patch
npm publish
```

### 8.2 处理依赖更新

定期更新依赖以修复安全漏洞：

```bash
npm audit
npm update
# 或使用npm-check-updates
ncu -u
npm install
```

### 8.3 监控和日志

实现日志记录以监控服务器运行状况：

```javascript
// 在src/index.ts中
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// 在生产环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 在处理函数中使用
logger.info('Query executed', { sql, duration, rowsAffected });
```

## 9. 最佳实践

1. **安全性**：
   - 不要在代码中硬编码敏感信息
   - 使用环境变量存储配置
   - 验证和清理所有用户输入

2. **性能**：
   - 使用连接池管理数据库连接
   - 实现请求限流
   - 优化频繁执行的查询

3. **可维护性**：
   - 编写详细的API文档
   - 保持高测试覆盖率
   - 使用TypeScript提高代码质量
   - 遵循ESLint规则

4. **可扩展性**：
   - 模块化设计
   - 实现插件系统
   - 使用依赖注入

## 10. 故障排除

### 常见问题：

1. **发布失败**：
   - 确保已登录npm：`npm whoami`
   - 检查包名是否已存在
   - 确保版本号唯一

2. **连接问题**：
   - 验证数据库凭据
   - 检查防火墙设置
   - 确认数据库服务正在运行

3. **性能问题**：
   - 使用`explain`分析慢查询
   - 检查数据库索引
   - 监控服务器资源使用情况

## 11. 结论

通过本文，你已经了解如何开发、测试、发布MCP服务器到npm，并使用`@modelcontextprotocol/inspector`与之交互。这个流程可以应用于任何MCP服务器的开发，不仅限于MySQL交互。

MCP协议为AI模型提供了标准化的工具调用方式，使AI能够与各种服务和数据源交互，极大扩展了AI应用的能力范围。

随着AI技术的发展，MCP服务器将成为连接AI模型与现实世界服务的重要桥梁。