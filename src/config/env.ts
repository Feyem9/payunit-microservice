import { z } from 'zod';

const envSchema = z.object({
  // PayUnit credentials
  PAYUNIT_API_USERNAME: z.string().min(1, 'PAYUNIT_API_USERNAME is required'),
  PAYUNIT_API_PASSWORD: z.string().min(1, 'PAYUNIT_API_PASSWORD is required'),
  PAYUNIT_API_KEY: z.string().min(1, 'PAYUNIT_API_KEY is required'),
  PAYUNIT_NOTIFY_URL: z.string().url('PAYUNIT_NOTIFY_URL must be a valid URL'),
  PAYUNIT_WEBHOOK_SECRET: z.string().min(1, 'PAYUNIT_WEBHOOK_SECRET is required'),
  PAYUNIT_MODE: z.enum(['test', 'live', 'SANDBOX', 'LIVE']).default('test'),
  PAYUNIT_BASE_URL: z.string().url().optional(), // Surcharge manuelle de l'URL de base

  // URLs de retour (optionnelles, chaque app peut les surcharger)
  PAYUNIT_RETURN_URL: z.string().url().optional(),
  PAYUNIT_CANCEL_URL: z.string().url().optional(),

  // Sécurité interne
  MICROSERVICE_API_KEY: z.string().min(16, 'MICROSERVICE_API_KEY must be at least 16 characters'),

  // Base de données
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),

  // Serveur
  PORT: z.string().regex(/^\d+$/).default('3000'),
  ALLOWED_ORIGINS: z.string().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  // eslint-disable-next-line no-console
  console.error('\n❌ Invalid environment configuration:\n');
  result.error.issues.forEach((e) => {
    // eslint-disable-next-line no-console
    console.error(`  - ${String(e.path.join('.'))}: ${e.message}`);
  });
  // eslint-disable-next-line no-console
  console.error('\nFix your .env file and restart the service.\n');
  process.exit(1);
}

export const env = result.data;
