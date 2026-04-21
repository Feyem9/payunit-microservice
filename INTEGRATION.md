# Guide d'intégration — PayUnit Microservice

Ce document explique comment intégrer le microservice de paiement PayUnit dans votre application.
Vous n'avez pas besoin de credentials PayUnit — le microservice les gère pour vous.

---

## 1. Configuration requise

Ajoutez ces 2 variables dans le `.env` de votre application :

```env
PAYUNIT_SERVICE_URL=https://payunit-microservice.onrender.com
PAYUNIT_SERVICE_KEY=DEMANDER_LA_CLE_AU_RESPONSABLE
```

> **Note :** Demandez la valeur de `PAYUNIT_SERVICE_KEY` au responsable du microservice.
> Ne partagez jamais cette clé publiquement.

---

## 2. Endpoints disponibles

| Méthode | URL | Description |
|---|---|---|
| `POST` | `/api/payment/initiate` | Créer un paiement |
| `GET` | `/api/payment/verify/:transactionId` | Vérifier le statut |
| `GET` | `/api/payment/events/:transactionId` | Écouter en temps réel (SSE) |
| `GET` | `/health` | Statut du service |

Tous les endpoints (sauf `/health`) requièrent le header :
```
x-api-key: VOTRE_PAYUNIT_SERVICE_KEY
```

---

## 3. Initier un paiement

### Requête

```http
POST /api/payment/initiate
Content-Type: application/json
x-api-key: VOTRE_CLE

{
  "amount": 5000,
  "currency": "XAF",
  "description": "Commande #123",
  "clientName": "Jean Dupont",
  "clientEmail": "jean@example.com",
  "notifyUrl": "https://votre-app.com/webhooks/payment",
  "returnUrl": "https://votre-app.com/payment/success",
  "cancelUrl": "https://votre-app.com/payment/cancel",
  "externalId": "commande_123"
}
```

### Champs

| Champ | Type | Requis | Description |
|---|---|---|---|
| `amount` | number | ✅ | Montant (entier positif) |
| `currency` | string | ❌ | Code ISO 3 lettres (défaut: XAF) |
| `description` | string | ✅ | Description du paiement (3-255 chars) |
| `clientName` | string | ✅ | Nom du client |
| `clientEmail` | string | ✅ | Email du client (format valide) |
| `notifyUrl` | string | ❌ | URL de votre webhook (recommandé) |
| `returnUrl` | string | ❌ | Redirection après paiement réussi |
| `cancelUrl` | string | ❌ | Redirection après annulation |
| `externalId` | string | ❌ | Votre ID interne (idempotence 10min) |
| `metadata` | object | ❌ | Données supplémentaires (clés/valeurs string) |

### Réponse succès (200)

```json
{
  "success": true,
  "data": {
    "transactionId": "uuid-v4",
    "paymentUrl": "https://gateway.payunit.net/pay/...",
    "status": "initiated"
  }
}
```

**→ Redirigez l'utilisateur vers `paymentUrl`.**

### Réponse erreur validation (400)

```json
{
  "success": false,
  "errors": [
    { "field": "clientEmail", "message": "clientEmail must be a valid email address" }
  ]
}
```

---

## 4. Mode asynchrone (optionnel)

Si vous ne voulez pas faire attendre l'utilisateur, ajoutez `?async=true` :

```http
POST /api/payment/initiate?async=true
```

Réponse immédiate (< 50ms) :

```json
{
  "success": true,
  "async": true,
  "data": {
    "transactionId": "uuid-v4",
    "status": "processing",
    "pollUrl": "/api/payment/verify/uuid-v4",
    "eventsUrl": "/api/payment/events/uuid-v4"
  }
}
```

Ensuite, récupérez le `paymentUrl` via polling ou SSE :

```javascript
// Polling (toutes les 2 secondes)
const poll = setInterval(async () => {
  const res = await fetch(`/api/payment/verify/${transactionId}`, {
    headers: { 'x-api-key': CLE }
  })
  const data = await res.json()
  if (data.data?.payment_url) {
    clearInterval(poll)
    window.location.href = data.data.payment_url
  }
}, 2000)

// OU Server-Sent Events (push temps réel)
const events = new EventSource(`/api/payment/events/${transactionId}`)
events.addEventListener('payment_ready', (e) => {
  const { paymentUrl } = JSON.parse(e.data)
  window.location.href = paymentUrl
  events.close()
})
```

---

## 5. Recevoir la confirmation (webhook)

Après le paiement, le microservice appelle votre `notifyUrl` avec :

```json
{
  "transaction_id": "uuid-v4",
  "status": "success",
  "amount": 5000,
  "external_id": "commande_123",
  "metadata": {}
}
```

### Valeurs possibles de `status`

| Status | Signification |
|---|---|
| `success` | Paiement confirmé ✅ |
| `failed` | Paiement échoué ❌ |
| `cancelled` | Annulé par l'utilisateur |
| `pending` | En attente de confirmation |

### Exemple de webhook par langage

**Django**
```python
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

@csrf_exempt
def payment_webhook(request):
    data = json.loads(request.body)
    if data['status'] == 'success':
        order = Order.objects.get(id=data['external_id'])
        order.mark_as_paid(data['transaction_id'])
    return JsonResponse({'received': True})
```

**Laravel**
```php
Route::post('/webhooks/payment', function (Request $request) {
    if ($request->status === 'success') {
        Order::find($request->external_id)
             ->update(['status' => 'paid']);
    }
    return response()->json(['received' => true]);
});
```

**Next.js**
```typescript
export async function POST(req: Request) {
  const data = await req.json()
  if (data.status === 'success') {
    await db.order.update({
      where: { id: data.external_id },
      data: { status: 'paid' }
    })
  }
  return Response.json({ received: true })
}
```

**Express.js**
```javascript
app.post('/webhooks/payment', (req, res) => {
  const { status, external_id, transaction_id } = req.body
  if (status === 'success') {
    Order.findByIdAndUpdate(external_id, { status: 'paid', transaction_id })
  }
  res.json({ received: true })
})
```

---

## 6. Vérifier un paiement manuellement

```http
GET /api/payment/verify/:transactionId
x-api-key: VOTRE_CLE
```

Utile pour vérifier le statut d'une transaction sans attendre le webhook.

---

## 7. Codes d'erreur HTTP

| Code | Signification |
|---|---|
| `400` | Données invalides (voir `errors` dans la réponse) |
| `401` | Clé API manquante ou invalide |
| `413` | Body trop volumineux (max 10kb) |
| `429` | Trop de requêtes (max 10 initiations/min) |
| `500` | Erreur serveur |
| `502` | Erreur PayUnit upstream |
| `503` | Service PayUnit indisponible |
| `504` | Timeout PayUnit |

---

## 8. Test rapide avec curl

```bash
# Remplacez VOTRE_CLE
curl -X POST https://payunit-microservice.onrender.com/api/payment/initiate \
  -H "Content-Type: application/json" \
  -H "x-api-key: VOTRE_CLE" \
  -d '{
    "amount": 100,
    "currency": "XAF",
    "description": "Test",
    "clientName": "Test User",
    "clientEmail": "test@example.com",
    "externalId": "test_001"
  }'
```

---

## 9. Bonnes pratiques

- Toujours fournir un `externalId` unique par transaction pour éviter les doublons
- Toujours implémenter le `notifyUrl` — ne pas se fier uniquement au `returnUrl`
- Vérifier le `status` dans le webhook avant de confirmer une commande
- Ne jamais exposer `PAYUNIT_SERVICE_KEY` côté client (frontend)
- En cas d'échec du webhook, le microservice réessaie automatiquement (1min → 5min → 15min → 1h → 6h)

---

## 10. Support

Pour toute question sur l'intégration, contactez le responsable du microservice.
