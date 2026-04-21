import rateLimit from 'express-rate-limit';

// Limite générale sur toutes les routes API
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: () => process.env['NODE_ENV'] === 'test',
});

// Limite stricte sur /initiate
export const initiateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many payment requests, please slow down.' },
  skip: () => process.env['NODE_ENV'] === 'test',
});
