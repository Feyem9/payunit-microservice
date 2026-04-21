import { PaymentResult } from '../payunit.service';

interface IdempotencyEntry {
  result: PaymentResult;
  createdAt: number;
}

// TTL de 10 minutes — au-delà on considère que c'est une nouvelle tentative légitime
const TTL_MS = 10 * 60 * 1000;

const store = new Map<string, IdempotencyEntry>();

export const idempotencyStore = {
  get(key: string): PaymentResult | null {
    const entry = store.get(key);
    if (!entry) return null;

    // Entrée expirée
    if (Date.now() - entry.createdAt > TTL_MS) {
      store.delete(key);
      return null;
    }

    return entry.result;
  },

  set(key: string, result: PaymentResult): void {
    store.set(key, { result, createdAt: Date.now() });
  },

  // Nettoyage périodique des entrées expirées
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.createdAt > TTL_MS) {
        store.delete(key);
      }
    }
  },
};

// Nettoyage toutes les 5 minutes
setInterval(() => idempotencyStore.cleanup(), 5 * 60 * 1000);
