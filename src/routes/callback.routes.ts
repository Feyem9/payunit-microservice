import { Router, Request, Response } from 'express';
import { PayUnitService } from '../payunit.service';
import logger from '../utils/logger';

export function createCallbackRouter(service: PayUnitService = new PayUnitService()): Router {
  const router = Router();

  // POST /api/payment/callback
  router.post('/', async (req: Request, res: Response) => {
    try {
      await service.handleCallback(req.body);
      res.json({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Callback processing failed';
      logger.error({ error: msg }, 'Callback route error');
      res.status(500).json({ success: false });
    }
  });

  return router;
}

export default createCallbackRouter();
