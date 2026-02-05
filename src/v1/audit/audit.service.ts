import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditLog,
  AuditAction,
  EntityType,
  AuditLogDocument,
} from './audit-log.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    action: AuditAction;
    entityType: EntityType;
    entityId?: string;
    userId: string;
    previousState?: any;
    newState?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Helper pour vérifier si une chaîne est un ObjectId valide
    const isValidObjectId = (id: string): boolean => {
      return /^[0-9a-f]{24}$/i.test(id);
    };

    const log = new this.auditModel({
      ...params,
      entityId:
        params.entityId && isValidObjectId(params.entityId)
          ? new Types.ObjectId(params.entityId)
          : undefined,
      userId: isValidObjectId(params.userId)
        ? new Types.ObjectId(params.userId)
        : null, // null si l'ID n'est pas valide (ex: tentative de login avec utilisateur inexistant)
    });
    return log.save();
  }
}
