import { describe, it, expect } from 'vitest';
import { initiatePaymentSchema } from '../validators/payment.validator';

const VALID = {
  amount: 5000,
  description: 'Test payment',
  clientName: 'Jean Dupont',
  clientEmail: 'jean@example.com',
};

describe('initiatePaymentSchema', () => {
  it('valide un payload correct', () => {
    const result = initiatePaymentSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it('rejette un montant négatif', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejette un montant à zéro', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejette un email invalide', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, clientEmail: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('rejette une description trop courte', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, description: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejette une currency invalide (pas 3 lettres)', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, currency: 'EURO' });
    expect(result.success).toBe(false);
  });

  it('convertit la currency en majuscules', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, currency: 'xaf' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe('XAF');
  });

  it('rejette une notifyUrl invalide', () => {
    const result = initiatePaymentSchema.safeParse({ ...VALID, notifyUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepte les champs optionnels absents', () => {
    const result = initiatePaymentSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });
});
