import { v4 as uuidv4 } from 'uuid';
import { env } from './config/env';
import { assertSafeUrl } from './utils/ssrf.guard';
import { payunitClient, notifyClient } from './utils/http.client';
import { extractPayUnitError } from './utils/payunit.error';
import { idempotencyStore } from './utils/idempotency.store';
import { transactionRepository } from './db/transaction.repository';
import { notificationRepository } from './db/notification.repository';
import { auditRepository } from './db/audit.repository';
import { sseStore } from './utils/sse.store';
import {
  paymentInitiatedCounter,
  callbackReceivedCounter,
  notifyForwardedCounter,
  payunitLatencyHistogram,
  idempotentHitsCounter,
} from './utils/metrics';
import logger from './utils/logger';

const isLive = env.PAYUNIT_MODE === 'live' || env.PAYUNIT_MODE === 'LIVE';
const BASE_URL = env.PAYUNIT_BASE_URL ||
  (isLive ? 'https://app.payunit.net/api' : 'https://gateway.payunit.net/api');

export interface InitiatePaymentDto {
  amount: number;
  currency?: string;
  description: string;
  clientName: string;
  clientEmail: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
  externalId?: string;
  metadata?: Record<string, string>;
  tenantKey?: string;
  ipAddress?: string;
}

export interface PaymentResult {
  transactionId: string;
  paymentUrl: string;
  status: string;
}

export interface PayUnitCallbackBody {
  transaction_id: string;
  status: string;
  amount: number;
  metadata?: {
    client_notify_url?: string;
    external_id?: string;
    [key: string]: string | undefined;
  };
}

export class PayUnitService {

  private getAuthHeader() {
    const credentials = Buffer.from(
      `${env.PAYUNIT_API_USERNAME}:${env.PAYUNIT_API_PASSWORD}`
    ).toString('base64');
    return {
      'Authorization': `Basic ${credentials}`,
      'x-api-key': env.PAYUNIT_API_KEY,
      'Content-Type': 'application/json',
      'mode': isLive ? 'live' : 'sandbox',
    };
  }

  async initiatePayment(dto: InitiatePaymentDto): Promise<PaymentResult> {
    if (dto.externalId) {
      const cached = idempotencyStore.get(dto.externalId);
      if (cached) {
        logger.info({ externalId: dto.externalId }, 'Returning cached payment result (idempotent)');
        idempotentHitsCounter.inc();
        auditRepository.log({
          eventType: 'PAYMENT_IDEMPOTENT_HIT',
          transactionId: cached.transactionId,
          tenantKey: dto.tenantKey,
          payload: { externalId: dto.externalId },
          ipAddress: dto.ipAddress,
        });
        return cached;
      }
    }

    const transactionId = uuidv4();
    const currency = dto.currency || 'XAF';

    const metadata = {
      ...dto.metadata,
      client_notify_url: dto.notifyUrl || '',
      external_id: dto.externalId || '',
    };

    const payload = {
      total_amount: dto.amount,
      currency,
      transaction_id: transactionId,
      description: dto.description,
      notify_url: env.PAYUNIT_NOTIFY_URL,
      return_url: dto.returnUrl || env.PAYUNIT_RETURN_URL,
      cancel_url: dto.cancelUrl || env.PAYUNIT_CANCEL_URL,
      purchaser_name: dto.clientName,
      purchaser_email: dto.clientEmail,
      metadata,
    };

    logger.info({ transactionId, amount: dto.amount, currency }, 'Initiating payment');

    const end = payunitLatencyHistogram.startTimer({ operation: 'initiate' });
    try {
      // Appel direct sans circuit breaker
      const response = await payunitClient.post(
        `${BASE_URL}/gateway/initialize`,
        payload,
        { headers: this.getAuthHeader() }
      );
      end();

      const data = response.data as Record<string, unknown>;
      const paymentUrl =
        (data['data'] as Record<string, string> | undefined)?.['transaction_url'] ||
        (data['data'] as Record<string, string> | undefined)?.['payment_url'] ||
        (data['transaction_url'] as string | undefined) ||
        (data['payment_url'] as string | undefined) || '';

      logger.info({ transactionId, paymentUrl, responseData: data }, 'PayUnit response received');

      const result: PaymentResult = { transactionId, paymentUrl, status: 'initiated' };

      paymentInitiatedCounter.inc({ status: 'success', currency });

      await transactionRepository.create({
        transaction_id: transactionId,
        external_id: dto.externalId,
        status: 'initiated',
        amount: dto.amount,
        currency,
        description: dto.description,
        client_name: dto.clientName,
        client_email: dto.clientEmail,
        payment_url: paymentUrl,
        notify_url: dto.notifyUrl,
        payunit_data: data,
      });

      auditRepository.log({
        eventType: 'PAYMENT_INITIATED',
        transactionId,
        tenantKey: dto.tenantKey,
        payload: { amount: dto.amount, currency, externalId: dto.externalId },
        ipAddress: dto.ipAddress,
      });

      if (dto.externalId) idempotencyStore.set(dto.externalId, result);
      sseStore.emit(transactionId, 'payment_ready', result);

      logger.info({ transactionId }, 'Payment initiated successfully');
      return result;

    } catch (error: unknown) {
      end();
      paymentInitiatedCounter.inc({ status: 'error', currency });
      const { message, statusCode, upstream } = extractPayUnitError(error);
      logger.error({
        transactionId, statusCode, upstream,
        errCode: (error as NodeJS.ErrnoException).code,
        errMsg: error instanceof Error ? error.message : String(error),
      }, `PayUnit initiate error: ${message}`);

      auditRepository.log({
        eventType: 'PAYMENT_INITIATION_FAILED',
        transactionId,
        tenantKey: dto.tenantKey,
        payload: { error: message, statusCode },
        ipAddress: dto.ipAddress,
      });

      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = statusCode;
      throw err;
    }
  }

  async verifyPayment(transactionId: string, tenantKey?: string): Promise<Record<string, unknown>> {
    logger.info({ transactionId }, 'Verifying payment');

    const end = payunitLatencyHistogram.startTimer({ operation: 'verify' });
    try {
      const response = await payunitClient.get(
        `${BASE_URL}/gateway/transaction/${transactionId}`,
        { headers: this.getAuthHeader() }
      );
      end();

      auditRepository.log({
        eventType: 'PAYMENT_VERIFIED',
        transactionId,
        tenantKey,
        payload: { status: (response.data as Record<string, unknown>)['status'] },
      });

      return response.data as Record<string, unknown>;
    } catch (error: unknown) {
      end();
      const { message, statusCode, upstream } = extractPayUnitError(error);
      logger.error({ transactionId, statusCode, upstream }, `PayUnit verify error: ${message}`);
      const err = new Error(message) as Error & { statusCode?: number };
      err.statusCode = statusCode;
      throw err;
    }
  }

  async handleCallback(body: PayUnitCallbackBody): Promise<boolean> {
    const { transaction_id, status, amount, metadata } = body;

    logger.info({ transaction_id, status, amount }, 'PayUnit callback received');
    callbackReceivedCounter.inc({ status: status || 'unknown' });

    await transactionRepository.updateStatus(transaction_id, status, body as unknown as Record<string, unknown>);

    auditRepository.log({
      eventType: 'CALLBACK_RECEIVED',
      transactionId: transaction_id,
      payload: { status, amount },
    });

    sseStore.emit(transaction_id, 'payment_status', { transaction_id, status, amount });

    if (metadata?.client_notify_url) {
      try {
        assertSafeUrl(metadata.client_notify_url);
        logger.info({ url: metadata.client_notify_url, transaction_id }, 'Forwarding notification to client');

        await notifyClient.post(metadata.client_notify_url, {
          transaction_id, status, amount,
          external_id: metadata.external_id,
          metadata,
        });

        notifyForwardedCounter.inc({ result: 'success' });
        auditRepository.log({ eventType: 'NOTIFICATION_SENT', transactionId: transaction_id });
        logger.info({ transaction_id }, 'Client notification sent successfully');

      } catch (error: unknown) {
        notifyForwardedCounter.inc({ result: 'error' });
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn({ transaction_id, url: metadata.client_notify_url, error: msg }, 'Notification failed — queuing for retry');

        await notificationRepository.enqueue(transaction_id, metadata.client_notify_url);
        auditRepository.log({
          eventType: 'NOTIFICATION_FAILED',
          transactionId: transaction_id,
          payload: { error: msg, url: metadata.client_notify_url },
        });
      }
    }

    return true;
  }
}
