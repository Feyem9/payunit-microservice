import axios from 'axios';
import axiosRetry from 'axios-retry';

// Client pour les appels vers l'API PayUnit
export const payunitClient = axios.create({
  timeout: 15000,
});

// Retry automatique sur les erreurs réseau et 5xx — max 3 tentatives
axiosRetry(payunitClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay, // 1s, 2s, 4s
  retryCondition: (error) => {
    // Retry sur erreur réseau ou timeout
    if (axiosRetry.isNetworkError(error)) return true;
    // Retry sur 503 (service indisponible) et 504 (gateway timeout)
    const status = error.response?.status;
    return status === 503 || status === 504;
  },
  onRetry: (retryCount, error) => {
    const status = error.response?.status;
    const msg = error.message;
    // Import dynamique pour éviter la dépendance circulaire
    import('./logger').then(({ default: logger }) => {
      logger.warn({ retryCount, status, msg }, 'Retrying PayUnit request');
    });
  },
});

// Client pour les notifications vers les apps clientes (forwarding)
// Pas de retry ici — on ne veut pas notifier deux fois
export const notifyClient = axios.create({
  timeout: 5000,
});
