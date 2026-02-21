// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './notification.schema';
import { PaginationResult } from '../interfaces/pagination.interface';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * NOTIFICATION UTILISATEUR : Envoie à un utilisateur spécifique
   * Et sauvegarde dans MongoDB pour l'historique
   */
  async notifyUser(userId: string, title: string, message: string) {
    // 1. Sauvegarde en base de données
    const savedNote = await new this.notificationModel({
      userId,
      title,
      message,
      isRead: false,
    }).save();

    // 2. Envoi en temps réel via Socket
    this.gateway.server.to(`user_${userId}`).emit('notification', savedNote);

    return savedNote;
  }

  /**
   * NOTIFICATION ADMIN : Envoie un événement spécial à tous les Admins connectés
   * Très utile pour les alertes système ou les nouvelles inscriptions
   */
  async notifyAllAdmins(title: string, message: string, data?: any) {
    const adminPayload = {
      title,
      message,
      metadata: data,
      type: 'ADMIN_ALERT',
      createdAt: new Date(),
    };

    // On émet sur un canal différent 'admin_event' pour le dashboard admin
    this.gateway.server.to('admin_room').emit('admin_event', adminPayload);

    console.log(`📢 Alerte Admin envoyée : ${title}`);
  }

  // Méthode pour récupérer l'historique (utile pour le front)
  async getUserNotifications(
    userId: string,
    query: any,
  ): Promise<PaginationResult<Notification>> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments({ userId }),
    ]);

    return {
      status: 'success',
      message: 'Notifications retrieved successfully',
      data: notifications,
      total,
      page,
      limit,
    };
  }
}
