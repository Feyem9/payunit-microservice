import { getPool } from './database';

export interface TransactionRecord {
  id?: number;
  transaction_id: string;
  external_id?: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  client_name: string;
  client_email: string;
  payment_url?: string;
  notify_url?: string;
  payunit_data?: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export const transactionRepository = {
  async create(record: Omit<TransactionRecord, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    await getPool().query(
      `INSERT INTO transactions
        (transaction_id, external_id, status, amount, currency, description,
         client_name, client_email, payment_url, notify_url, payunit_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        record.transaction_id, record.external_id ?? null, record.status,
        record.amount, record.currency, record.description,
        record.client_name, record.client_email,
        record.payment_url ?? null, record.notify_url ?? null,
        record.payunit_data ?? null,
      ]
    );
  },

  async updateStatus(transactionId: string, status: string, payunitData?: Record<string, unknown>): Promise<void> {
    await getPool().query(
      `UPDATE transactions
       SET status = $1, payunit_data = COALESCE($2, payunit_data), updated_at = NOW()
       WHERE transaction_id = $3`,
      [status, payunitData ?? null, transactionId]
    );
  },

  async findByTransactionId(transactionId: string): Promise<TransactionRecord | null> {
    const result = await getPool().query(
      'SELECT * FROM transactions WHERE transaction_id = $1',
      [transactionId]
    );
    return result.rows[0] ?? null;
  },

  async findByExternalId(externalId: string): Promise<TransactionRecord | null> {
    const result = await getPool().query(
      'SELECT * FROM transactions WHERE external_id = $1 ORDER BY created_at DESC LIMIT 1',
      [externalId]
    );
    return result.rows[0] ?? null;
  },
};
