# Notifications WebSocket (Socket.io)

## Connexion

Le client se connecte en fournissant `userId` et `userAccess` en query params :

```javascript
const socket = io('https://api.commercegestion.online', {
  query: {
    userId: '69b3ba868559353c9a3967f9',     // ObjectId de l'utilisateur connecté
    userAccess: 'USER'                      // 'USER' | 'ADMIN' | 'SUPERADMIN'
  },
  transports: ['websocket', 'polling']
});
```

### Rooms automatiques
- `user_{userId}` : room privée de l'utilisateur (notifications personnelles)
- `admin_room` : room partagée pour les admins (alertes système)

## Événements émis par le serveur

### 1. `notification` (utilisateur standard)
Émis quand une transaction le concernant est **créée**, **approuvée** ou **rejetée**.

```typescript
// Payload reçu
{
  _id: ObjectId,
  userId: string,
  title: string,           // ex: "Nouveau Dépôt", "Retrait approuvé"
  message: string,         // détail lisible
  isRead: false,
  createdAt: Date,
  // metadata optionnelle selon le type
}
```

Exemples de `title` / `message` :
| Action | Title | Message |
|--------|-------|---------|
| Création DÉPÔT | "Nouveau Dépôt" | "Vous avez reçu un dépôt de 1 500 kg de Riz (2026-08-27-15-30-00-ABC123)" |
| Création RETRAIT | "Nouveau Retrait" | "Vous avez reçu un retrait de 100 kg de Maïs (2026-08-27-15-30-00-DEF456)" |
| Approbation DÉPÔT | "Dépôt approuvé" | "Votre dépôt de 1 500 kg de Riz a été approuvé par Jean DUPONT (2026-08-27-15-30-00-ABC123)" |
| Rejet RETRAIT | "Retrait rejeté" | "Votre retrait de 100 kg de Maïs a été rejeté par Jean DUPONT : Stock insuffisant (2026-08-27-15-30-00-DEF456)" |

### 2. `admin_event` (admins uniquement)
Émis pour les alertes système (nouvelle inscription, erreur critique, etc.).

```typescript
{
  title: string,
  message: string,
  metadata: any,
  type: 'ADMIN_ALERT',
  createdAt: Date
}
```

## Intégration Frontend (exemple React)

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useNotifications(userId, userAccess) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL, {
      query: { userId, userAccess },
      transports: ['websocket']
    });

    socket.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      // Optionnel: toast, son, badge, etc.
    });

    if (userAccess === 'ADMIN') {
      socket.on('admin_event', (evt) => {
        console.log('🚨 Admin alert:', evt);
      });
    }

    return () => socket.disconnect();
  }, [userId, userAccess]);

  return notifications;
}
```

## Événements déclenchés (côté backend)

| Endpoint / Action | Événement WebSocket émis |
|-------------------|--------------------------|
| `POST /api/v1/transactions/deposit` | `notification` → destinataire + initiateur |
| `POST /api/v1/transactions/return` | `notification` → détenteur + retrayant |
| `POST /api/v1/transactions/vente` | `notification` → acheteur + vendeur |
| `PATCH /api/v1/transactions/:id/approve` | `notification` → destinataire + initiateur |
| `PATCH /api/v1/transactions/:id/reject` | `notification` → destinataire + initiateur |

## Historique (REST)

Récupérer les notifications persistées en base :

```
GET /api/v1/notifications?page=1&limit=20
Authorization: Bearer <token>
```

Réponse paginée avec `isRead`, `createdAt`, etc.

### Lecture et affichage des notifications

Les notifications arrivent avec `isRead: false`. Le serveur expose les actions
suivantes pour conserver cet état et synchronise les autres onglets connectés :

```
PATCH /api/v1/notifications/:notificationId/read
PATCH /api/v1/notifications/read-all
Authorization: Bearer <token>
```

`read-all` renvoie `{ updatedCount }` et émet l'événement Socket.io
`notifications_read_all`. Une lecture individuelle émet `notification_read`
avec `{ notificationId }`.

Le front doit masquer les notifications lues par défaut. L'option **Tout
afficher** affiche également les lues, en gris ; les non lues restent en gras.
Après **Tout marquer lu**, il marque l'état local comme lu puis, si *Tout
afficher* est désactivé, la boîte devient vide immédiatement.

```tsx
const [showRead, setShowRead] = useState(false);

const visibleNotifications = notifications.filter(
  (notification) => showRead || !notification.isRead,
);

async function markAllAsRead() {
  await api.patch('/v1/notifications/read-all');
  setNotifications((items) =>
    items.map((item) => ({ ...item, isRead: true })),
  );
}

socket.on('notification_read', ({ notificationId }) => {
  setNotifications((items) => items.map((item) =>
    item._id === notificationId ? { ...item, isRead: true } : item,
  ));
});
socket.on('notifications_read_all', () => {
  setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
});

// Rendu : fontWeight: notification.isRead ? 400 : 700,
//          color: notification.isRead ? '#9ca3af' : 'inherit'
```

## Architecture

```
TransactionsService
   ├── sendCreationNotification()  → notificationsService.notifyUser()
   ├── sendApprovalNotification()  → notificationsService.notifyUser()
   └── sendRejectionNotification() → notificationsService.notifyUser()

NotificationsService
   ├── notifyUser(userId, title, message)
   │    ├── Sauvegarde en MongoDB (collection notifications)
   │    └── Émet via gateway.server.to(`user_${userId}`).emit('notification', doc)
   └── notifyAllAdmins(title, message, data)
        └── gateway.server.to('admin_room').emit('admin_event', payload)

NotificationsGateway
   ├── handleConnection()  → client.join(`user_${userId}`) [+ admin_room si ADMIN]
   └── handleDisconnect()
```

## Déploiement

- Socket.io configuré avec CORS `origin: '*'` (à restreindre en prod)
- Fonctionne derrière un reverse proxy (nginx) avec `proxy_http_version 1.1` + `upgrade` headers
- Pas de store Redis requis pour une seule instance ; pour scaling horizontal, ajouter `@nestjs/platform-socket.io` adapter Redis
