# PayUnit Microservice

Microservice centralisé pour les paiements PayUnit. Toutes vos applications appellent ce service — elles n'ont jamais accès aux credentials PayUnit directement.

```
App A (Django)   ──┐
App B (Laravel)  ──┼──► payunit-microservice ──► PayUnit API
App C (Next.js)  ──┘
```

## Prérequis

- Node.js 20+
- Un compte PayUnit ([payunit.net](https://payunit.net))

## Installation

```bash
git clone <repo>
cd payunit-microservice
npm install
cp .env.example .env
# Remplir les variables dans .env
npm run dev
```

## Configuration `.env`

| Variable | Description | Requis |
|---|---|---|
| `PAYUNIT_API_USERNAME` | Username PayUnit (dashboard) | ✅ |
| `PAYUNIT_API_PASSWORD` | Password PayUnit (dashboard) | ✅ |
| `PAYUNIT_API_KEY` | API Key PayUnit (dashboard) | ✅ |
| `PAYUNIT_NOTIFY_URL` | URL publique de ce microservice + `/api/payment/callback` | ✅ |
| `PAYUNIT_WEBHOOK_SECRET` | Secret HMAC partagé avec PayUnit | ✅ |
| `PAYUNIT_MODE` | `test` ou `live` | ✅ |
| `PAYUNIT_BASE_URL` | Surcharge l'URL de base PayUnit | ❌ |
| `MICROSERVICE_API_KEY` | Clé(s) d'accès pour vos apps (séparées par virgule) | ✅ |
| `PORT` | Port du serveur (défaut: 3000) | ❌ |
| `ALLOWED_ORIGINS` | Origines CORS autorisées (séparées par virgule) | ❌ |
| `DB_PATH` | Chemin vers la base SQLite (défaut: `./data/payunit.db`) | ❌ |

### Multi-tenant — plusieurs apps

```env
MICROSERVICE_API_KEY=key_online_learning_xxx,key_ecommerce_yyy,key_b2b_zzz
```

## Endpoints

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | ❌ | Statut du service |
| `GET` | `/metrics` | ✅ (prod) | Métriques Prometheus |
| `GET` | `/docs` | ❌ (dev) | Documentation Swagger |
| `POST` | `/api/payment/initiate` | ✅ | Initier un paiement |
| `GET` | `/api/payment/verify/:id` | ✅ | Vérifier un paiement |
| `POST` | `/api/payment/callback` | HMAC | Webhook PayUnit |

> Les routes `/v1/payment/*` sont des alias pour le versioning.

## Intégration

### Python / Django

```python
import requests

response = requests.post(
    "https://ton-microservice.com/api/payment/initiate",
    headers={"x-api-key": "key_online_learning_xxx"},
    json={
        "amount": 15000,
        "currency": "XAF",
        "description": "Cours Python avancé",
        "clientName": "Jean Dupont",
        "clientEmail": "jean@example.com",
        "notifyUrl": "https://online-learning.com/webhook/payment",
        "externalId": "course_789"
    }
)
payment_url = response.json()["data"]["paymentUrl"]
# Rediriger l'utilisateur vers payment_url
```

### JavaScript / Next.js

```javascript
const res = await fetch("https://ton-microservice.com/api/payment/initiate", {
  method: "POST",
  headers: {
    "x-api-key": "key_ecommerce_yyy",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: 45000,
    description: "Commande #456",
    clientName: "Marie Martin",
    clientEmail: "marie@example.com",
    notifyUrl: "https://ecommerce.com/api/webhook/payment",
    externalId: "order_456"
  })
});
const { data } = await res.json();
// Rediriger vers data.paymentUrl
```

### PHP / Laravel

```php
$response = Http::withHeaders([
    'x-api-key' => 'key_b2b_zzz',
])->post('https://ton-microservice.com/api/payment/initiate', [
    'amount'      => 250000,
    'description' => 'Facture #INV-2026-001',
    'clientName'  => 'Entreprise ABC',
    'clientEmail' => 'contact@abc.com',
    'notifyUrl'   => 'https://b2b.com/webhooks/payment',
    'externalId'  => 'invoice_001',
]);
$paymentUrl = $response->json('data.paymentUrl');
```

## Recevoir le callback dans votre app

Quand PayUnit confirme le paiement, le microservice notifie votre `notifyUrl` :

```json
{
  "transaction_id": "uuid-v4",
  "status": "success",
  "amount": 15000,
  "external_id": "course_789",
  "metadata": {}
}
```

## Déploiement Docker

```bash
docker-compose up -d
```

## Scripts

```bash
npm run dev          # Développement (hot reload)
npm run build        # Compilation TypeScript
npm run lint         # ESLint
npm run lint:fix     # Correction automatique
npm test             # Tests unitaires
npm run test:coverage # Tests + couverture
npm start            # Production (après build)
```
