import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { apiKeyMiddleware } from './middleware/auth.middleware';
import { webhookSignatureMiddleware } from './middleware/webhook.middleware';
import { globalLimiter } from './middleware/rate-limit.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { createPaymentRouter } from './routes/payment.routes';
import { createCallbackRouter } from './routes/callback.routes';
import { PayUnitService } from './payunit.service';
import { payunitClient } from './utils/http.client';
import { swaggerDocument } from './docs/swagger';
import { registry } from './utils/metrics';
import { notificationRepository } from './db/notification.repository';
import logger from './utils/logger';

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

const isLive = env.PAYUNIT_MODE === 'live' || env.PAYUNIT_MODE === 'LIVE';
const BASE_URL = env.PAYUNIT_BASE_URL ||
  (isLive ? 'https://app.payunit.net/api' : 'https://gateway.payunit.net/api');

export function createApp(service?: PayUnitService) {
  const app = express();

  // Faire confiance au proxy Render/Cloudflare pour le rate limiting et les IPs
  app.set('trust proxy', 1);

  const allowedOrigins = env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(compression());
  app.use(requestIdMiddleware);

  // Log HTTP automatique avec requestId sur chaque requête
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] as string,
    customLogLevel: (_req, res) => res.statusCode >= 500 ? 'error' : 'info',
    // Ne pas logger /health et /metrics pour éviter le bruit
    autoLogging: {
      ignore: (req) => req.url === '/health' || req.url === '/metrics',
    },
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  }));

  app.use(globalLimiter);

  app.use(express.json({
    limit: '10kb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      (req as RequestWithRawBody).rawBody = buf.toString('utf8');
    },
  }));

  app.get('/health', async (_req, res) => {
    const start = Date.now();
    let payunitStatus = 'unreachable';

    try {
      // Client direct sans circuit breaker pour le health check
      const { default: axios } = await import('axios');
      await axios.get(`${BASE_URL}/health`, {
        headers: { 'x-api-key': env.PAYUNIT_API_KEY },
        timeout: 3000,
      });
      payunitStatus = 'reachable';
    } catch {
      // reste 'unreachable'
    }

    const latency = Date.now() - start;

    let notificationStats = { pending: 0, failed: 0, success: 0 };
    try {
      notificationStats = await notificationRepository.getStats();
    } catch { /* DB pas encore initialisée */ }

    res.json({
      status: 'ok',
      service: 'payunit-microservice',
      mode: env.PAYUNIT_MODE,
      uptime: Math.floor(process.uptime()),
      payunit: payunitStatus,
      latencyMs: latency,
      notifications: notificationStats,
      timestamp: new Date().toISOString(),
    });
  });

  // Swagger UI — disponible uniquement hors production
  if (env.NODE_ENV !== 'production') {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  // Métriques Prometheus — protégées en production par la clé API
  app.get('/metrics', env.NODE_ENV === 'production' ? apiKeyMiddleware : (_req, res, next) => next(), async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  app.use('/api/payment/callback', webhookSignatureMiddleware, createCallbackRouter(service));
  app.use('/api/payment', apiKeyMiddleware, createPaymentRouter(service));

  // Alias v1 pour le versioning
  app.use('/v1/payment/callback', webhookSignatureMiddleware, createCallbackRouter(service));
  app.use('/v1/payment', apiKeyMiddleware, createPaymentRouter(service));

  return app;
}
