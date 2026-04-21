import { Response } from 'express';

// Map transactionId → liste de clients SSE connectés
const clients = new Map<string, Response[]>();

export const sseStore = {
  add(transactionId: string, res: Response): void {
    const existing = clients.get(transactionId) || [];
    clients.set(transactionId, [...existing, res]);
  },

  remove(transactionId: string, res: Response): void {
    const existing = clients.get(transactionId) || [];
    const updated = existing.filter((r) => r !== res);
    if (updated.length === 0) {
      clients.delete(transactionId);
    } else {
      clients.set(transactionId, updated);
    }
  },

  // Envoie un événement à tous les clients connectés pour cette transaction
  emit(transactionId: string, event: string, data: unknown): void {
    const existing = clients.get(transactionId);
    if (!existing || existing.length === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of existing) {
      try {
        res.write(payload);
      } catch {
        // Client déconnecté
      }
    }
  },

  count(): number {
    return clients.size;
  },
};
