// src/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserAccess } from 'src/v1/users/users.schema';

@WebSocketGateway({
  cors: {
    origin: '*', // En production, remplacez par votre URL frontend
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /**
   * Gère la connexion d'un client
   */
  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    const userAccess = client.handshake.query.userAccess as string;

    if (!userId) {
      console.log(
        `⚠️ Connexion refusée : userId manquant (Client: ${client.id})`,
      );
      client.disconnect();
      return;
    }

    // 1. Chaque utilisateur rejoint sa propre room privée (user_ID)
    client.join(`user_${userId}`);

    // 2. Si l'utilisateur est un ADMIN, il rejoint la room collective "admin_room"
    if (userAccess === UserAccess.ADMIN) {
      client.join('admin_room');
      console.log(`👑 Admin connecté : ${userId} | Room: admin_room`);
    } else {
      console.log(`👤 Utilisateur connecté : ${userId} | Room: user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client déconnecté : ${client.id}`);
  }
}
