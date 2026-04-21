import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { env } from './config/env';
import { createApp } from './app';
import { migrate, closePool } from './db/database';
import { startNotificationWorker, stopNotificationWorker } from './workers/notification.worker';
import logger from './utils/logger';

const app = createApp();
const PORT = env.PORT;
const server = http.createServer(app);

async function start() {
  await migrate();
  server.listen(PORT, () => {
    logger.info({ port: PORT, mode: env.PAYUNIT_MODE }, 'PayUnit microservice started');
    startNotificationWorker();
  });
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

// Graceful shutdown — attend la fin des requêtes en cours avant de s'arrêter
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received, closing server...');

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error during server close');
      process.exit(1);
    }
    stopNotificationWorker();
    await closePool();
    logger.info('Server closed gracefully');
    process.exit(0);
  });

  // Forcer l'arrêt après 10s si des requêtes traînent
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Erreurs non gérées — log et arrêt propre
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  shutdown('uncaughtException');
});
