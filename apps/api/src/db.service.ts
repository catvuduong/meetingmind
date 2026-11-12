import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

/** Runs one statement on the connection that owns the current transaction. */
export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

// Add new tables here as extra statements; they are all created once, behind a lock.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
  `CREATE TABLE IF NOT EXISTS meetings (
     id SERIAL PRIMARY KEY,
     title TEXT NOT NULL,
     meeting_date DATE NOT NULL,
     transcript TEXT NOT NULL,
     summary JSONB NOT NULL,
     decisions JSONB NOT NULL,
     source TEXT NOT NULL CHECK (source IN ('ai', 'rules')),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS action_items (
     id SERIAL PRIMARY KEY,
     meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
     position INTEGER NOT NULL,
     task TEXT NOT NULL,
     owner TEXT,
     due_date DATE,
     status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  'CREATE INDEX IF NOT EXISTS action_items_meeting_idx ON action_items (meeting_id)',
  'CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now())',
];

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    : null;
  private ready: Promise<void> | null = null;

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  /** Runs `work` inside one BEGIN/COMMIT. Any thrown error rolls the whole unit back. */
  async transaction<T>(work: (query: Query) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query: Query = async <R>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[];
      const result = await work(query);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      // Concurrent instances (serverless cold starts, parallel test files) race on CREATE TABLE IF NOT EXISTS,
      // so serialize schema setup behind a transaction-scoped advisory lock.
      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(727274)');
        for (const statement of SCHEMA) await client.query(statement);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        this.ready = null;
        throw err;
      } finally {
        client.release();
      }
    })();
    return this.ready;
  }
}
