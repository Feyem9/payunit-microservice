import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import logger from '../utils/logger';

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function webhookSignatureMiddleware(req: RequestWithRawBody, res: Response, next: NextFunction): void {
  const secret = env.PAYUNIT_WEBHOOK_SECRET;
  const signature = req.headers['x-payunit-signature'] as string | undefined;

  if (!signature) {
    logger.warn('Missing x-payunit-signature header');
    res.status(401).json({ error: 'Missing webhook signature' });
    return;
  }

  // Protection replay attack — vérifier le timestamp si présent
  const timestampHeader = req.headers['x-payunit-timestamp'] as string | undefined;
  if (timestampHeader) {
    const timestamp = parseInt(timestampHeader, 10);
    const age = Date.now() - timestamp;

    if (isNaN(timestamp) || age > MAX_TIMESTAMP_AGE_MS || age < -30000) {
      logger.warn({ age, timestamp }, 'Webhook replay attack detected — timestamp too old or invalid');
      res.status(401).json({ error: 'Webhook timestamp expired or invalid' });
      return;
    }
  }

  const rawBody: string = req.rawBody ?? JSON.stringify(req.body);

  // Si timestamp présent, on l'inclut dans la signature pour plus de sécurité
  const signedPayload = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    logger.warn('Invalid webhook signature');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}
