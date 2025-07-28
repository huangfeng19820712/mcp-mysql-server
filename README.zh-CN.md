# @fhuang/mcp-mysql-server 中文说明

一个基于 Model Context Protocol (MCP) 的 MySQL 数据库服务端，支持 AI 模型通过标准接口安全地操作 MySQL 数据库。

---

## 安装方法

### 1. 使用 Smithery 自动安装

```bash
npx -y @smithery/cli install @fhuang/mcp-mysql-server --client claude
```

### 2. 手动安装

```bash
npx @fhuang/mcp-mysql-server
```

---

## 配置方法

在 MCP 配置文件中设置数据库连接参数，支持两种方式：

**方式一：URL 方式**

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@fhuang/mcp-mysql-server", "mysql://user:password@localhost:port/database"]
    }
  }
}
```

**方式二：环境变量方式**

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@fhuang/mcp-mysql-server"],
      "env": {
        "MYSQL_HOST": "your_host",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

---

## 用法示例

1. 连接数据库
2. 执行查询、插入、更新、删除等操作
3. 列出所有表和表结构

**示例代码：**

```typescript
// 连接数据库
use_mcp_tool({
  server_name: "mysql",
  tool_name: "connect_db",
  arguments: {
    host: "localhost",
    user: "your_user",
    password: "your_password",
    database: "your_database"
  }
});

// 查询
use_mcp_tool({
  server_name: "mysql",
  tool_name: "query",
  arguments: {
    sql: "SELECT * FROM users WHERE id = ?",
    params: [1]
  }
});
```

---

## 主要功能

- 自动安全管理数据库连接
- 支持参数化查询，防止 SQL 注入
- 错误详细提示
- TypeScript 支持
- 自动关闭连接
- 支持SQL性能分析（EXPLAIN）

## 可用工具

### 7. explain
分析SQL查询性能，返回执行计划详情，包括访问类型、扫描行数和可能的优化建议。

```typescript
use_mcp_tool({
  server_name: "mysql",
  tool_name: "explain",
  arguments: {
    sql: "SELECT * FROM users WHERE id = ?"
  }
});
```

---

## 安全性

- 所有查询均使用参数化语句
- 密码等敏感信息通过环境变量管理
- 查询前自动校验
- 连接用完自动关闭

---

## 错误处理

- 连接失败、参数缺失、SQL 错误等均有详细报错信息

---

## 贡献

欢迎提交 Pull Request！  
GitHub 地址：https://github.com/huangfeng19820712/mcp-mysql-server

---

## 许可证

MIT