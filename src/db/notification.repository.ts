import { getPool } from './database';

export interface NotificationAttempt {
  id: number;
  transaction_id: string;
  notify_url: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  last_error?: string;
  next_retry_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

// Délais de retry en minutes : 1, 5, 15, 60, 360
const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 360];
export const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length;

export const notificationRepository = {
  async enqueue(transactionId: string, notifyUrl: string): Promise<void> {
    const nextRetry = new Date(Date.now() + RETRY_DELAYS_MINUTES[0] * 60 * 1000);
    await getPool().query(
      `INSERT INTO notification_attempts (transaction_id, notify_url, status, attempts, next_retry_at)
       VALUES ($1, $2, 'pending', 0, $3)`,
      [transactionId, notifyUrl, nextRetry]
    );
  },

  async markSuccess(id: number): Promise<void> {
    await getPool().query(
      `UPDATE notification_attempts SET status = 'success', updated_at = NOW() WHERE id = $1`,
      [id]
    );
  },

  async markFailed(id: number, error: string, attempts: number): Promise<void> {
    const nextRetry = attempts < MAX_ATTEMPTS
      ? new Date(Date.now() + RETRY_DELAYS_MINUTES[attempts] * 60 * 1000)
      : null;
    const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

    await getPool().query(
      `UPDATE notification_attempts
       SET status = $1, attempts = $2, last_error = $3, next_retry_at = $4, updated_at = NOW()
       WHERE id = $5`,
      [status, attempts, error, nextRetry, id]
    );
  },

  async getPending(): Promise<NotificationAttempt[]> {
    const result = await getPool().query(
      `SELECT * FROM notification_attempts
       WHERE status = 'pending' AND next_retry_at <= NOW()
       ORDER BY next_retry_at ASC LIMIT 20`
    );
    return result.rows;
  },

  async getStats(): Promise<{ pending: number; failed: number; success: number }> {
    const result = await getPool().query(
      `SELECT status, COUNT(*)::int as count FROM notification_attempts GROUP BY status`
    );
    return result.rows.reduce(
      (acc: { pending: number; failed: number; success: number }, row: { status: string; count: number }) =>
        ({ ...acc, [row.status]: row.count }),
      { pending: 0, failed: 0, success: 0 }
    );
  },
};
