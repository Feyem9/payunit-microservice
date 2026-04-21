import { notificationRepository, NotificationAttempt, MAX_ATTEMPTS } from '../db/notification.repository';
import { auditRepository } from '../db/audit.repository';
import { assertSafeUrl } from '../utils/ssrf.guard';
import { notifyClient } from '../utils/http.client';
import { notifyForwardedCounter } from '../utils/metrics';
import logger from '../utils/logger';

const POLL_INTERVAL_MS = 30 * 1000;

async function processOne(attempt: NotificationAttempt): Promise<void> {
  const { id, transaction_id, notify_url, attempts } = attempt;

  try {
    assertSafeUrl(notify_url);

    await notifyClient.post(notify_url, {
      transaction_id,
      source: 'retry',
      attempt: attempts + 1,
    });

    await notificationRepository.markSuccess(id);
    notifyForwardedCounter.inc({ result: 'success' });
    auditRepository.log({ eventType: 'NOTIFICATION_RETRY_SUCCESS', transactionId: transaction_id });
    logger.info({ transaction_id, notify_url, attempt: attempts + 1 }, 'Notification retry succeeded');

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const newAttempts = attempts + 1;

    await notificationRepository.markFailed(id, msg, newAttempts);
    notifyForwardedCounter.inc({ result: 'error' });

    if (newAttempts >= MAX_ATTEMPTS) {
      auditRepository.log({
        eventType: 'NOTIFICATION_PERMANENTLY_FAILED',
        transactionId: transaction_id,
        payload: { notify_url, attempts: newAttempts },
      });
      logger.error({ transaction_id, notify_url, attempts: newAttempts }, 'Notification permanently failed after max retries');
    } else {
      logger.warn({ transaction_id, notify_url, attempt: newAttempts, error: msg }, 'Notification retry failed, will retry later');
    }
  }
}

async function processPending(): Promise<void> {
  const pending = await notificationRepository.getPending();
  if (pending.length === 0) return;

  logger.info({ count: pending.length }, 'Processing pending notifications');
  for (const attempt of pending) {
    await processOne(attempt);
  }
}

let workerInterval: ReturnType<typeof setInterval> | null = null;

export function startNotificationWorker(): void {
  if (workerInterval) return;

  logger.info({ intervalMs: POLL_INTERVAL_MS }, 'Notification worker started');

  processPending().catch((err: unknown) => {
    logger.error({ err }, 'Notification worker error on startup');
  });

  workerInterval = setInterval(() => {
    processPending().catch((err: unknown) => {
      logger.error({ err }, 'Notification worker error');
    });
  }, POLL_INTERVAL_MS);
}

export function stopNotificationWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Notification worker stopped');
  }
}
