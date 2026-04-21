export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'PayUnit Microservice API',
    version: '1.0.0',
    description: 'Microservice centralisé pour les paiements PayUnit. Toutes les routes (sauf /health et /docs) requièrent le header `x-api-key`.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    schemas: {
      InitiatePaymentRequest: {
        type: 'object',
        required: ['amount', 'description', 'clientName', 'clientEmail'],
        properties: {
          amount: { type: 'number', example: 5000, description: 'Montant en centimes ou unité de la devise' },
          currency: { type: 'string', example: 'XAF', description: 'Code ISO 3 lettres (défaut: XAF)' },
          description: { type: 'string', example: 'Commande #123' },
          clientName: { type: 'string', example: 'Jean Dupont' },
          clientEmail: { type: 'string', format: 'email', example: 'jean@example.com' },
          returnUrl: { type: 'string', format: 'uri', example: 'https://mon-app.com/payment/success' },
          cancelUrl: { type: 'string', format: 'uri', example: 'https://mon-app.com/payment/cancel' },
          notifyUrl: { type: 'string', format: 'uri', example: 'https://mon-app.com/webhook/payment', description: 'URL de votre app pour recevoir la confirmation de paiement' },
          externalId: { type: 'string', example: 'order_456', description: 'Votre ID interne — utilisé pour l\'idempotence' },
          metadata: { type: 'object', additionalProperties: { type: 'string' }, example: { userId: '123' } },
        },
      },
      PaymentResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              transactionId: { type: 'string', example: 'uuid-v4' },
              paymentUrl: { type: 'string', format: 'uri', example: 'https://gateway.payunit.net/pay/...' },
              status: { type: 'string', example: 'initiated' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Payment initiation failed' },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'clientEmail' },
                message: { type: 'string', example: 'clientEmail must be a valid email address' },
              },
            },
          },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'Service opérationnel',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    mode: { type: 'string', example: 'test' },
                    uptime: { type: 'number', example: 3600 },
                    payunit: { type: 'string', example: 'reachable' },
                    latencyMs: { type: 'number', example: 142 },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/payment/initiate': {
      post: {
        tags: ['Payment'],
        summary: 'Initier un paiement',
        description: 'Crée une transaction PayUnit et retourne l\'URL de paiement. Si `externalId` est fourni, la requête est idempotente (10 min).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/InitiatePaymentRequest' },
            },
          },
        },
        responses: {
          200: { description: 'Paiement initié', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentResult' } } } },
          400: { description: 'Données invalides', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
          401: { description: 'Clé API manquante ou invalide' },
          429: { description: 'Trop de requêtes' },
          500: { description: 'Erreur serveur', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/payment/verify/{transactionId}': {
      get: {
        tags: ['Payment'],
        summary: 'Vérifier le statut d\'un paiement',
        parameters: [
          { name: 'transactionId', in: 'path', required: true, schema: { type: 'string' }, example: 'uuid-v4' },
        ],
        responses: {
          200: { description: 'Statut du paiement' },
          401: { description: 'Clé API manquante ou invalide' },
          500: { description: 'Erreur serveur' },
        },
      },
    },
    '/api/payment/callback': {
      post: {
        tags: ['Webhook'],
        summary: 'Callback PayUnit (webhook)',
        description: 'Appelé par PayUnit après un paiement. Protégé par signature HMAC (`x-payunit-signature`). Ne pas appeler directement.',
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transaction_id: { type: 'string' },
                  status: { type: 'string', example: 'success' },
                  amount: { type: 'number' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Callback traité' },
          401: { description: 'Signature invalide' },
        },
      },
    },
  },
};
