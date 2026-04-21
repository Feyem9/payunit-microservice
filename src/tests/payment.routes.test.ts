import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Les mocks doivent être déclarés avant tout import qui dépend de config/env
vi.mock('../config/env', () => ({
  env: {
    PAYUNIT_API_USERNAME: 'test_user',
    PAYUNIT_API_PASSWORD: 'test_pass',
    PAYUNIT_API_KEY: 'test_key',
    PAYUNIT_NOTIFY_URL: 'https://microservice.test/api/payment/callback',
    PAYUNIT_WEBHOOK_SECRET: 'test_webhook_secret',
    PAYUNIT_MODE: 'test',
    MICROSERVICE_API_KEY: 'test_microservice_key_1234',
    PORT: '3000',
    ALLOWED_ORIGINS: '',
  },
}));

import { createApp } from '../app';
import { PayUnitService } from '../payunit.service';

const VALID_PAYLOAD = {
  amount: 5000,
  currency: 'XAF',
  description: 'Test payment',
  clientName: 'Jean Dupont',
  clientEmail: 'jean@example.com',
};

const API_KEY_HEADER = { 'x-api-key': 'test_microservice_key_1234' };

describe('POST /api/payment/initiate', () => {
  it('retourne 401 sans clé API', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    const app = createApp(mockService);
    const res = await request(app).post('/api/payment/initiate').send(VALID_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it('retourne 400 si le body est invalide', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    const app = createApp(mockService);
    const res = await request(app)
      .post('/api/payment/initiate')
      .set(API_KEY_HEADER)
      .send({ amount: -100 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  it('retourne 400 si email invalide', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    const app = createApp(mockService);
    const res = await request(app)
      .post('/api/payment/initiate')
      .set(API_KEY_HEADER)
      .send({ ...VALID_PAYLOAD, clientEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('retourne 200 avec un payload valide', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    const mockResult = { transactionId: 'txn-123', paymentUrl: 'https://sandbox.payunit.net/pay/txn-123', status: 'initiated' };
    vi.mocked(mockService.initiatePayment).mockResolvedValue(mockResult);
    const app = createApp(mockService);
    const res = await request(app)
      .post('/api/payment/initiate')
      .set(API_KEY_HEADER)
      .send(VALID_PAYLOAD);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toBe('txn-123');
  });

  it('retourne 500 si le service lève une erreur', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    vi.mocked(mockService.initiatePayment).mockRejectedValue(new Error('PayUnit unavailable'));
    const app = createApp(mockService);
    const res = await request(app)
      .post('/api/payment/initiate')
      .set(API_KEY_HEADER)
      .send(VALID_PAYLOAD);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('PayUnit unavailable');
  });
});

describe('GET /api/payment/verify/:transactionId', () => {
  it('retourne 401 sans clé API', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    const app = createApp(mockService);
    const res = await request(app).get('/api/payment/verify/txn-123');
    expect(res.status).toBe(401);
  });

  it('retourne les données du paiement', async () => {
    const mockService = { initiatePayment: vi.fn(), verifyPayment: vi.fn(), handleCallback: vi.fn() } as unknown as PayUnitService;
    vi.mocked(mockService.verifyPayment).mockResolvedValue({ status: 'success', amount: 5000 });
    const app = createApp(mockService);
    const res = await request(app)
      .get('/api/payment/verify/txn-123')
      .set(API_KEY_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('success');
  });
});

describe('GET /health', () => {
  it('retourne ok sans auth', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
