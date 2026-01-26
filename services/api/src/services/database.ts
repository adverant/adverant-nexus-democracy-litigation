/**
 * Database Service
 *
 * PostgreSQL connection pool and query utilities
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../server';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Connect to database
   */
  public async connect(): Promise<void> {
    if (this.pool) {
      logger.warn('Database already connected');
      return;
    }

    const config = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'nexus_auth',
      user: process.env.DATABASE_USER || 'nexus_user',
      password: process.env.DATABASE_PASSWORD,
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000', 10),
      // Enable PostGIS and extended error info
      options: '-c search_path=dl,public,postgis',
    };

    try {
      this.pool = new Pool(config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Setup event listeners
      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
      });

      this.pool.on('connect', () => {
        logger.debug('New database connection established');
      });

      this.pool.on('acquire', () => {
        logger.debug('Database connection acquired from pool');
      });

      this.pool.on('remove', () => {
        logger.debug('Database connection removed from pool');
      });

      logger.info('Database connected successfully', {
        host: config.host,
        port: config.port,
        database: config.database,
        maxConnections: config.max,
      });
    } catch (error) {
      logger.error('Database connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        config: {
          host: config.host,
          port: config.port,
          database: config.database,
        },
      });
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  public async disconnect(): Promise<void> {
    if (!this.pool) {
      logger.warn('Database not connected');
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Database disconnection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute a query
   */
  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const start = Date.now();

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        query: text.substring(0, 100),
        params: params?.slice(0, 5),
        rows: result.rowCount,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Query failed', {
        query: text.substring(0, 100),
        params: params?.slice(0, 5),
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  public async queryOne<T = any>(
    text: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  public async queryMany<T = any>(
    text: string,
    params?: any[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Get a client for transaction
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    return await this.pool.connect();
  }

  /**
   * Execute queries in a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  public async checkHealth(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rowCount === 1;
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    if (!this.pool) {
      return { total: 0, idle: 0, waiting: 0 };
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Convert camelCase object keys to snake_case for database
   */
  public static toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }

    return result;
  }

  /**
   * Convert snake_case object keys to camelCase for API
   */
  public static toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }

    return result;
  }

  /**
   * Build WHERE clause from filters
   */
  public static buildWhereClause(
    filters: Record<string, any>,
    startIndex: number = 1
  ): { where: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startIndex;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) {
        continue;
      }

      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

      if (Array.isArray(value)) {
        conditions.push(`${snakeKey} = ANY($${paramIndex})`);
        params.push(value);
        paramIndex++;
      } else {
        conditions.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { where, params };
  }

  /**
   * Build pagination clause
   */
  public static buildPaginationClause(
    page: number = 1,
    limit: number = 20
  ): { limit: number; offset: number } {
    const sanitizedLimit = Math.min(Math.max(limit, 1), 100);
    const sanitizedPage = Math.max(page, 1);
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    return { limit: sanitizedLimit, offset };
  }
}
