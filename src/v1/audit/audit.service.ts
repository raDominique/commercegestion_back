import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditLog,
  AuditAction,
  EntityType,
  AuditLogDocument,
} from './audit-log.schema';
import { ExportService } from '../../shared/export/export.service';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
    private readonly exportService: ExportService,
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
        : null,
    });
    return log.save();
  }

  async findLogsByUserId(userId: string) {
    // Helper pour vérifier si une chaîne est un ObjectId valide
    const isValidObjectId = (id: string): boolean => /^[0-9a-f]{24}$/i.test(id);

    const userObjectId = isValidObjectId(userId)
      ? new Types.ObjectId(userId)
      : null;
    if (!userObjectId) {
      throw new Error('Invalid userId');
    }
    return this.auditModel.find({ userId: userObjectId }).exec();
  }

  async findAllLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.auditModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'userName userFirstname userEmail')
        .exec(),
      this.auditModel.countDocuments(),
    ]);

    return {
      status: 'success',
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async exportAll(format: 'excel' | 'pdf', userId?: string): Promise<string> {
    const items = await this.auditModel.find().sort({ createdAt: -1 }).lean().exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const subfolder = 'audit-export';
    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Action', key: 'action' },
      { header: 'Entité', key: 'entityType' },
      { header: 'ID Entité', key: 'entityId' },
      { header: 'Utilisateur', key: 'userId' },
      { header: 'Date', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(items, columns, 'AuditLogs', subfolder);
    }
    return this.exportService.exportPDF(
      'Liste des Audits',
      columns.map(c => c.header),
      items.map(item => columns.map(c => String(item[c.key] ?? ''))),
      subfolder,
    );
  }
}
