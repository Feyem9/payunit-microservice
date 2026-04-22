import axios from 'axios';
import axiosRetry from 'axios-retry';
import * as http from 'http';
import * as https from 'https';

// Client pour les appels vers l'API PayUnit — force HTTP/1.1 (PayUnit ne supporte pas HTTP/2)
export const payunitClient = axios.create({
  timeout: 30000, // 30 secondes
  httpAgent: new http.Agent({ keepAlive: false }),
  httpsAgent: new https.Agent({ keepAlive: false }),
});

// Retry automatique sur les erreurs réseau et 5xx — max 3 tentatives
axiosRetry(payunitClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Ne pas retry si le circuit est ouvert
    if (error.message?.includes('circuit')) return false;
    if (axiosRetry.isNetworkError(error)) return true;
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
