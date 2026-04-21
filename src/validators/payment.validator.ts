import { z } from 'zod';

export const initiatePaymentSchema = z.object({
  amount: z
    .number({ error: 'amount is required and must be a number' })
    .positive('amount must be greater than 0'),

  currency: z
    .string()
    .length(3, 'currency must be a 3-letter ISO code (e.g. XAF, USD)')
    .toUpperCase()
    .optional(),

  description: z
    .string({ error: 'description is required' })
    .min(3, 'description must be at least 3 characters')
    .max(255, 'description must be at most 255 characters'),

  clientName: z
    .string({ error: 'clientName is required' })
    .min(2, 'clientName must be at least 2 characters')
    .max(100),

  clientEmail: z
    .string({ error: 'clientEmail is required' })
    .email('clientEmail must be a valid email address'),

  returnUrl: z.string().url('returnUrl must be a valid URL').optional(),
  cancelUrl: z.string().url('cancelUrl must be a valid URL').optional(),
  notifyUrl: z.string().url('notifyUrl must be a valid URL').optional(),

  externalId: z.string().max(100).optional(),

  metadata: z.record(z.string(), z.string()).optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
