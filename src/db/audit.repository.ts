import { getPool } from './database';

export type AuditEventType =
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_INITIATION_FAILED'
  | 'PAYMENT_IDEMPOTENT_HIT'
  | 'CALLBACK_RECEIVED'
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED'
  | 'NOTIFICATION_RETRY_SUCCESS'
  | 'NOTIFICATION_PERMANENTLY_FAILED'
  | 'PAYMENT_VERIFIED';

export interface AuditEntry {
  eventType: AuditEventType;
  transactionId?: string;
  tenantKey?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
}

export const auditRepository = {
  async log(entry: AuditEntry): Promise<void> {
    // Fire-and-forget — on ne bloque jamais le flux principal pour un log d'audit
    getPool().query(
      `INSERT INTO audit_log (event_type, transaction_id, tenant_key, payload, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.eventType,
        entry.transactionId ?? null,
        entry.tenantKey ?? null,
        entry.payload ?? null,
        entry.ipAddress ?? null,
      ]
    ).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[AuditLog] Failed to write audit entry:', err);
    });
  },
};
