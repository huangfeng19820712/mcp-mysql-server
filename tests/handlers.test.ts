import { handleQuery, handleExecute, handleListTables, handleDescribeTable, handleShowStatement, QueryArgs, ExecuteArgs, DescribeTableArgs, ShowArgs } from '../src/handlers.js';
import { Pool } from 'mysql2/promise';

jest.mock('mysql2/promise');
const mockPool = {
  query: jest.fn()
} as unknown as Pool;

describe('handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleQuery', () => {
    it('should return rows for valid SELECT', async () => {
      mockPool.query = jest.fn().mockResolvedValue([[{ id: 1, name: 'test' }]]);
      const args: QueryArgs = { sql: 'SELECT * FROM users' };
      const result = await handleQuery(mockPool, args);
      expect(result.content[0].text).toContain('test');
    });
    it('should throw error for non-SELECT', async () => {
      const args: QueryArgs = { sql: 'UPDATE users SET name="a"' };
      await expect(handleQuery(mockPool, args)).rejects.toThrow();
    });
  });

  describe('handleExecute', () => {
    it('should return result for valid non-SELECT', async () => {
      mockPool.query = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);
      const args: ExecuteArgs = { sql: 'UPDATE users SET name="a"' };
      const result = await handleExecute(mockPool, args);
      expect(result.content[0].text).toContain('affectedRows');
    });
    it('should throw error for SELECT', async () => {
      const args: ExecuteArgs = { sql: 'SELECT * FROM users' };
      await expect(handleExecute(mockPool, args)).rejects.toThrow();
    });
  });

  describe('handleListTables', () => {
    it('should return tables', async () => {
      mockPool.query = jest.fn().mockResolvedValue([[{ 'Tables_in_test': 'users' }]]);
      const result = await handleListTables(mockPool);
      expect(result.content[0].text).toContain('users');
    });
  });

  describe('handleDescribeTable', () => {
    it('should return table structure', async () => {
      mockPool.query = jest.fn().mockResolvedValue([[{ Field: 'id', Type: 'int' }]]);
      const args: DescribeTableArgs = { table: 'users' };
      const result = await handleDescribeTable(mockPool, args);
      expect(result.content[0].text).toContain('Field');
    });
    it('should throw error if table is missing', async () => {
      // @ts-expect-error
      await expect(handleDescribeTable(mockPool, {})).rejects.toThrow();
    });
  });
});

describe('handleShowStatement', () => {
  it('should return result for valid SHOW statement', async () => {
    mockPool.query = jest.fn().mockResolvedValue([[{ Variable_name: 'max_connections', Value: '151' }]]);
    const args: ShowArgs = { sql: 'SHOW VARIABLES' };
    const result = await handleShowStatement(mockPool, args);
    expect(result.content[0].text).toContain('max_connections');
  });
  it('should throw error for non-SHOW statement', async () => {
    const args: ShowArgs = { sql: 'SELECT * FROM users' };
    await expect(handleShowStatement(mockPool, args)).rejects.toThrow();
  });
}); 