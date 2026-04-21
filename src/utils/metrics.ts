import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

// Métriques système (CPU, mémoire, event loop, etc.)
collectDefaultMetrics({ register: registry });

// Nombre de paiements initiés par statut (success / error)
export const paymentInitiatedCounter = new Counter({
  name: 'payunit_payments_initiated_total',
  help: 'Total number of payment initiations',
  labelNames: ['status', 'currency'],
  registers: [registry],
});

// Nombre de callbacks reçus de PayUnit par statut
export const callbackReceivedCounter = new Counter({
  name: 'payunit_callbacks_received_total',
  help: 'Total number of PayUnit webhook callbacks received',
  labelNames: ['status'],
  registers: [registry],
});

// Nombre de notifications forwarded vers les apps clientes
export const notifyForwardedCounter = new Counter({
  name: 'payunit_notify_forwarded_total',
  help: 'Total number of client notifications forwarded',
  labelNames: ['result'], // success / error
  registers: [registry],
});

// Latence des appels vers l'API PayUnit
export const payunitLatencyHistogram = new Histogram({
  name: 'payunit_api_duration_seconds',
  help: 'Duration of PayUnit API calls in seconds',
  labelNames: ['operation'], // initiate / verify
  buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10, 15],
  registers: [registry],
});

// Nombre de hits idempotents (requêtes dupliquées détectées)
export const idempotentHitsCounter = new Counter({
  name: 'payunit_idempotent_hits_total',
  help: 'Total number of idempotent payment requests served from cache',
  registers: [registry],
});
