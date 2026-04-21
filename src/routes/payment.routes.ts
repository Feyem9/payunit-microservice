import { Router, Request, Response } from 'express';
import { PayUnitService } from '../payunit.service';
import { validate } from '../middleware/validate.middleware';
import { initiatePaymentSchema } from '../validators/payment.validator';
import { initiateLimiter } from '../middleware/rate-limit.middleware';
import { sseStore } from '../utils/sse.store';
import logger from '../utils/logger';

interface ServiceError extends Error {
  statusCode?: number;
}

export function createPaymentRouter(service: PayUnitService = new PayUnitService()): Router {
  const router = Router();

  /**
   * POST /api/payment/initiate
   *
   * Mode synchrone (défaut) : attend la réponse de PayUnit, retourne paymentUrl directement.
   * Mode asynchrone (?async=true) : répond immédiatement avec transactionId,
   * l'app poll /verify/:id ou écoute /events/:id pour recevoir le paymentUrl.
   */
  router.post('/initiate', initiateLimiter, validate(initiatePaymentSchema), async (req: Request, res: Response) => {
    const isAsync = req.query['async'] === 'true';

    if (isAsync) {
      // Réponse immédiate — traitement en arrière-plan
      const { v4: uuidv4 } = await import('uuid');
      const transactionId = uuidv4();

      res.json({
        success: true,
        async: true,
        data: {
          transactionId,
          status: 'processing',
          pollUrl: `/api/payment/verify/${transactionId}`,
          eventsUrl: `/api/payment/events/${transactionId}`,
        },
      });

      // Traitement en arrière-plan
      service.initiatePayment({ ...req.body, _transactionId: transactionId }).catch((error: unknown) => {
        const err = error as ServiceError;
        logger.error({ error: err.message, transactionId }, 'Async payment initiation failed');
        sseStore.emit(transactionId, 'payment_error', { error: err.message });
      });

      return;
    }

    // Mode synchrone (défaut)
    try {
      const result = await service.initiatePayment(req.body);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const err = error as ServiceError;
      const msg = err.message || 'Payment initiation failed';
      const status = err.statusCode || 500;
      logger.error({ error: msg }, 'Initiate route error');
      res.status(status).json({ success: false, error: msg });
    }
  });

  /**
   * GET /api/payment/verify/:transactionId
   * Vérifie le statut d'un paiement — utilisé pour le polling en mode async.
   */
  router.get('/verify/:transactionId', async (req: Request, res: Response) => {
    try {
      const data = await service.verifyPayment(req.params['transactionId']);
      res.json({ success: true, data });
    } catch (error: unknown) {
      const err = error as ServiceError;
      const msg = err.message || 'Verification failed';
      const status = err.statusCode || 500;
      logger.error({ error: msg, transactionId: req.params['transactionId'] }, 'Verify route error');
      res.status(status).json({ success: false, error: msg });
    }
  });

  /**
   * GET /api/payment/events/:transactionId
   * Server-Sent Events — push du statut en temps réel sans polling.
   * L'app ouvre cette connexion et reçoit les événements dès qu'ils arrivent.
   */
  router.get('/events/:transactionId', (req: Request, res: Response) => {
    const { transactionId } = req.params;

    // Headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering nginx
    res.flushHeaders();

    // Ping toutes les 15s pour garder la connexion ouverte
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    // Enregistrer le client
    sseStore.add(transactionId, res);
    logger.info({ transactionId }, 'SSE client connected');

    // Nettoyage à la déconnexion
    req.on('close', () => {
      clearInterval(pingInterval);
      sseStore.remove(transactionId, res);
      logger.info({ transactionId }, 'SSE client disconnected');
    });
  });

  return router;
}

export default createPaymentRouter();
