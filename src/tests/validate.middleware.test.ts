import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { validate } from '../middleware/validate.middleware';
import { initiatePaymentSchema } from '../validators/payment.validator';

vi.mock('../config/env', () => ({
  env: {
    MICROSERVICE_API_KEY: 'test_key_1234',
    ALLOWED_ORIGINS: '',
    PAYUNIT_MODE: 'test',
    PAYUNIT_WEBHOOK_SECRET: 'secret',
    PAYUNIT_NOTIFY_URL: 'https://test.com/callback',
    PAYUNIT_API_USERNAME: 'u',
    PAYUNIT_API_PASSWORD: 'p',
    PAYUNIT_API_KEY: 'k',
    PORT: '3000',
  },
}));

describe('validate middleware', () => {
  const app = express();
  app.use(express.json());
  app.post('/test', validate(initiatePaymentSchema), (_req, res) => {
    res.json({ success: true });
  });

  it('retourne 400 pour un body invalide', async () => {
    const res = await request(app).post('/test').send({ amount: -100 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('retourne 200 pour un body valide', async () => {
    const res = await request(app).post('/test').send({
      amount: 5000,
      description: 'Test',
      clientName: 'Jean',
      clientEmail: 'jean@example.com',
    });
    expect(res.status).toBe(200);
  });
});
