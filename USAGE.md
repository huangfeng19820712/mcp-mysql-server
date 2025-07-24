# MCP MySQL Server 使用指南

## 简介

MCP MySQL Server是一个基于Model Context Protocol (MCP)的数据库服务端，允许AI模型通过标准化接口安全地与MySQL数据库交互。本指南将详细介绍如何安装、配置和使用该服务。

## 安装方法

### 前提条件
- Node.js 14.x或更高版本
- npm 6.x或更高版本
- MySQL数据库服务器
- 网络连接（用于安装依赖包）

### 安装步骤

#### 方法1：通过Smithery安装（推荐）

```bash
npx -y @smithery/cli install @fhuang/mcp-mysql-server --client claude
```

#### 方法2：手动安装

```bash
# 创建项目目录
mkdir mcp-mysql-server && cd mcp-mysql-server

# 初始化项目
npm init -y

# 安装依赖
npm install @fhuang/mcp-mysql-server
```

## 配置指南

MCP MySQL Server支持两种配置方式：命令行参数和环境变量。

### 方式1：使用MySQL连接URL（推荐）

```bash
npx @fhuang/mcp-mysql-server mysql://user:password@localhost:3306/database
```

### 方式2：使用环境变量

创建`.env`文件：

```ini
MYSQL_HOST=localhost
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database
MYSQL_PORT=3306

# 连接池配置
CONNECTION_LIMIT=10
QUEUE_LIMIT=0
```

然后启动服务：

```bash
npx @fhuang/mcp-mysql-server
```

### 方式3：在MCP客户端中配置

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@fhuang/mcp-mysql-server"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

## 工具使用详解

### 1. connect_db - 连接数据库

建立与MySQL数据库的连接。

**参数：**
- `host`: 数据库主机地址
- `user`: 数据库用户名
- `password`: 数据库密码
- `database`: 数据库名称
- `port` (可选): 数据库端口，默认为3306

**示例：**

```typescript
use_mcp_tool({
  server_name: "mysql",
  tool_name: "connect_db",
  arguments: {
    host: "localhost",
    user: "root",
    password: "password",
    database: "mydb"
  }
});
```

### 2. query - 执行查询

执行SELECT查询语句，支持参数化查询以防止SQL注入。

**参数：**
- `sql`: SELECT查询语句
- `params` (可选): 查询参数数组

**示例：**

```typescript
// 简单查询
use_mcp_tool({
  server_name: "mysql",
  tool_name: "query",
  arguments: {
    sql: "SELECT * FROM users"
  }
});

// 参数化查询
use_mcp_tool({
  server_name: "mysql",
  tool_name: "query",
  arguments: {
    sql: "SELECT * FROM users WHERE age > ? AND status = ?",
    params: [18, "active"]
  }
});
```

### 3. execute - 执行写操作

执行INSERT、UPDATE或DELETE语句，支持参数化查询。

**参数：**
- `sql`: INSERT/UPDATE/DELETE语句
- `params` (可选): 查询参数数组

**示例：**

```typescript
// 插入数据
use_mcp_tool({
  server_name: "mysql",
  tool_name: "execute",
  arguments: {
    sql: "INSERT INTO users (name, email) VALUES (?, ?)",
    params: ["John Doe", "john@example.com"]
  }
});

// 更新数据
use_mcp_tool({
  server_name: "mysql",
  tool_name: "execute",
  arguments: {
    sql: "UPDATE users SET status = ? WHERE id = ?",
    params: ["inactive", 123]
  }
});
```

### 4. list_tables - 列出所有表

获取数据库中所有表的列表。

**参数：** 无

**示例：**

```typescript
use_mcp_tool({
  server_name: "mysql",
  tool_name: "list_tables",
  arguments: {}
});
```

### 5. describe_table - 查看表结构

获取指定表的结构信息，包括字段名、数据类型和约束条件。

**参数：**
- `table`: 表名

**示例：**

```typescript
use_mcp_tool({
  server_name: "mysql",
  tool_name: "describe_table",
  arguments: {
    table: "users"
  }
});
```

### 6. show_statement - 执行SHOW语句

执行MySQL SHOW语句，用于获取数据库服务器状态和配置信息。

**参数：**
- `sql`: SHOW语句

**示例：**

```typescript
// 查看数据库参数
use_mcp_tool({
  server_name: "mysql",
  tool_name: "show_statement",
  arguments: {
    sql: "SHOW VARIABLES LIKE 'max_connections'"
  }
});

// 查看连接状态
use_mcp_tool({
  server_name: "mysql",
  tool_name: "show_statement",
  arguments: {
    sql: "SHOW STATUS LIKE 'Threads_connected'"
  }
});
```

### 7. explain - 分析查询性能

使用EXPLAIN语句分析查询执行计划，帮助识别性能瓶颈。

**参数：**
- `sql`: 需要分析的SELECT语句

**示例：**

```typescript
use_mcp_tool({
  server_name: "mysql",
  tool_name: "explain",
  arguments: {
    sql: "SELECT * FROM users WHERE age > 18 AND status = 'active'"
  }
});
```

## 错误处理

MCP MySQL Server提供详细的错误信息，常见错误及解决方法：

### 连接错误
- **错误信息**: `DATABASE_CONNECTION_FAILED`
- **可能原因**: MySQL服务器未运行、连接参数错误、网络问题
- **解决方法**: 检查MySQL服务器状态、验证连接参数、测试网络连接

### 查询错误
- **错误信息**: `DATABASE_QUERY_FAILED` 或 `DATABASE_EXECUTE_FAILED`
- **可能原因**: SQL语法错误、权限不足、表或字段不存在
- **解决方法**: 检查SQL语法、验证用户权限、确认表结构

### 参数错误
- **错误信息**: `INVALID_PARAMS`
- **可能原因**: 缺少必填参数、参数类型错误
- **解决方法**: 检查参数是否完整、验证参数类型

## 性能优化

### 连接池配置
通过环境变量调整连接池参数：

```ini
# 最大连接数
CONNECTION_LIMIT=20

# 排队限制，0表示无限制
QUEUE_LIMIT=50
```

### 查询优化
1. 使用参数化查询提高性能和安全性
2. 对频繁查询的字段创建索引
3. 使用`explain`工具分析慢查询
4. 避免SELECT *，只查询需要的字段

## 安全最佳实践

1. **保护敏感信息**
   - 不要在代码中硬编码数据库凭证
   - 使用环境变量或配置文件存储敏感信息
   - 限制数据库用户权限

2. **防止SQL注入**
   - 始终使用参数化查询
   - 避免直接拼接SQL字符串

3. **日志管理**
   - 定期审查日志文件
   - 不要在日志中记录密码等敏感信息

## 常见问题

### Q: 如何查看服务器日志？
A: 日志文件默认保存在项目根目录的`server.log`文件中。

### Q: 连接池 connections 和 threads_connected 有什么区别？
A: connections是应用程序级别的连接池配置，而threads_connected是MySQL服务器级别的实际连接数。

### Q: 如何更新MCP MySQL Server到最新版本？
A: 使用命令 `npm update @fhuang/mcp-mysql-server`

### Q: 服务启动后无法连接到数据库，如何排查？
A: 
1. 检查MySQL服务器是否正常运行
2. 验证连接参数是否正确
3. 检查防火墙设置
4. 查看日志文件获取详细错误信息

## 高级功能

### 事务支持
虽然当前版本未直接提供事务API，但可以通过execute工具执行事务相关语句：

```typescript
// 开始事务
use_mcp_tool({
  server_name: "mysql",
  tool_name: "execute",
  arguments: {
    sql: "START TRANSACTION"
  }
});

// 提交事务
use_mcp_tool({
  server_name: "mysql",
  tool_name: "execute",
  arguments: {
    sql: "COMMIT"
  }
});

// 回滚事务
use_mcp_tool({
  server_name: "mysql",
  tool_name: "execute",
  arguments: {
    sql: "ROLLBACK"
  }
});
```

### 监控连接池状态

```typescript
// 查看连接池状态
use_mcp_tool({
  server_name: "mysql",
  tool_name: "show_statement",
  arguments: {
    sql: "SHOW STATUS LIKE 'Threads_connected'"
  }
});
```

## 总结

MCP MySQL Server提供了一套完整的工具集，使AI模型能够安全、高效地与MySQL数据库交互。通过本指南，您应该能够快速安装、配置和使用该服务，并利用其提供的各种功能进行数据库操作和性能分析。

如需更多帮助，请查看项目GitHub仓库或提交issue。