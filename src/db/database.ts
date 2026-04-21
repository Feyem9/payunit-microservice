import { Pool } from 'pg';
import { env } from '../config/env';
import logger from '../utils/logger';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,                // max connexions simultanées
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error');
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

export async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id              SERIAL PRIMARY KEY,
        transaction_id  TEXT    NOT NULL UNIQUE,
        external_id     TEXT,
        status          TEXT    NOT NULL DEFAULT 'initiated',
        amount          NUMERIC NOT NULL,
        currency        TEXT    NOT NULL DEFAULT 'XAF',
        description     TEXT    NOT NULL,
        client_name     TEXT    NOT NULL,
        client_email    TEXT    NOT NULL,
        payment_url     TEXT,
        notify_url      TEXT,
        payunit_data    JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_external_id
        ON transactions(external_id);

      CREATE INDEX IF NOT EXISTS idx_transactions_status
        ON transactions(status);

      CREATE TABLE IF NOT EXISTS notification_attempts (
        id              SERIAL PRIMARY KEY,
        transaction_id  TEXT    NOT NULL REFERENCES transactions(transaction_id),
        notify_url      TEXT    NOT NULL,
        status          TEXT    NOT NULL DEFAULT 'pending',
        attempts        INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        next_retry_at   TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notification_pending
        ON notification_attempts(status, next_retry_at)
        WHERE status = 'pending';

      CREATE TABLE IF NOT EXISTS audit_log (
        id              SERIAL PRIMARY KEY,
        event_type      TEXT    NOT NULL,
        transaction_id  TEXT,
        tenant_key      TEXT,
        payload         JSONB,
        ip_address      TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_transaction
        ON audit_log(transaction_id);

      CREATE INDEX IF NOT EXISTS idx_audit_log_created
        ON audit_log(created_at DESC);
    `);

    logger.info('Database migration completed');
  } finally {
    client.release();
  }
}
