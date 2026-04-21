import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

// Support multi-tenant : MICROSERVICE_API_KEY peut contenir plusieurs clés séparées par des virgules
// Ex: MICROSERVICE_API_KEY=key_app_a,key_app_b,key_app_c
const validKeys = new Set(
  env.MICROSERVICE_API_KEY
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
);

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string | undefined;

  if (!key || !validKeys.has(key)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Attache l'identifiant du tenant à la requête pour les logs
  (req as Request & { tenantKey?: string }).tenantKey = key.slice(-6); // derniers 6 chars pour les logs

  next();
}
