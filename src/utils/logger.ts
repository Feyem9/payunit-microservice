import pino from 'pino';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  // Masquer les données sensibles dans tous les logs
  redact: {
    paths: [
      'req.headers["x-api-key"]',
      'req.headers.authorization',
      '*.clientEmail',
      '*.client_email',
      '*.password',
      '*.PAYUNIT_API_PASSWORD',
    ],
    censor: '[REDACTED]',
  },
  transport: process.env['NODE_ENV'] !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;
