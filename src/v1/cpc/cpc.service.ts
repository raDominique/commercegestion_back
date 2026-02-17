import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CpcProduct } from './cpc.schema';
import { CreateCpcDto } from './dto/create-cpc.dto';
import { UpdateCpcDto } from './dto/update-cpc.dto';
import { AuditService } from 'src/v1/audit/audit.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class CpcService {
  constructor(
    @InjectModel(CpcProduct.name) private model: Model<CpcProduct>,
    private readonly auditService: AuditService,
    private readonly logger: LoggerService
  ) { }

  /**
   * Créer une nouvelle entrée CPC
   */
  async create(data: CreateCpcDto, userId: string): Promise<PaginationResult<CpcProduct>> {
    this.logger.debug('CPC', `Création du code ${data.code}`);

    const created = await new this.model(data).save();

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: 'CPC' as EntityType,
      entityId: created._id.toString(),
      userId: userId,
      newState: created.toObject(),
    });

    return {
      status: 'success',
      message: 'Code CPC créé avec succès',
      data: [created]
    };
  }

  /**
   * Liste paginée avec filtres
   */
  async findAll(query: any): Promise<PaginationResult<CpcProduct>> {
    const { page = 1, limit = 10, niveau, search } = query;
    const filter: any = {};
    if (niveau) filter.niveau = niveau;
    if (search) filter.nom = { $regex: search, $options: 'i' };

    const [data, total] = await Promise.all([
      this.model.find(filter).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).sort({ code: 1 }).exec(),
      this.model.countDocuments(filter)
    ]);

    return {
      status: 'success',
      message: 'Données récupérées',
      data,
      total,
      page: Number(page),
      limit: Number(limit)
    };
  }

  /**
   * Trouver les enfants directs d'un code
   */
  async findChildren(parentCode: string, query: any = {}): Promise<PaginationResult<CpcProduct>> {
    const { page = 1, limit = 10 } = query;

    this.logger.debug('CPC', `Recherche des enfants pour: ${parentCode}`);

    const [data, total] = await Promise.all([
      this.model.find({ parentCode }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).sort({ code: 1 }).exec(),
      this.model.countDocuments({ parentCode })
    ]);

    return {
      status: 'success',
      message: `${total} enfant(s) trouvé(s)`,
      data,
      total,
      page: Number(page),
      limit: Number(limit)
    };
  }

  /**
   * Obtenir un code par son identifiant métier
   */
  async findOne(code: string): Promise<PaginationResult<CpcProduct>> {
    const res = await this.model.findOne({ code }).exec();
    if (!res) throw new NotFoundException(`Code ${code} introuvable`);

    return { status: 'success', message: 'Élément trouvé', data: [res] };
  }

  /**
   * Mettre à jour (avec gestion stricte de null pour TS)
   */
  async update(code: string, data: UpdateCpcDto, userId: string): Promise<PaginationResult<CpcProduct>> {
    const previous = await this.model.findOne({ code }).exec();
    if (!previous) throw new NotFoundException('Code introuvable pour modification');

    const updated = await this.model.findOneAndUpdate({ code }, data, { new: true }).exec();

    // Type Guard pour rassurer TypeScript sur le retour non-null
    if (!updated) {
      throw new NotFoundException('Erreur fatale lors de la mise à jour');
    }

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: 'CPC' as EntityType,
      entityId: updated._id.toString(),
      userId: userId,
      previousState: previous.toObject(),
      newState: updated.toObject(),
    });

    return {
      status: 'success',
      message: 'Mise à jour réussie',
      data: [updated]
    };
  }

  /**
   * Supprimer une entrée
   */
  async delete(code: string, userId: string): Promise<PaginationResult<CpcProduct>> {
    const toDelete = await this.model.findOne({ code }).exec();
    if (!toDelete) throw new NotFoundException('Code introuvable pour suppression');

    await this.model.deleteOne({ code }).exec();

    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: 'CPC' as EntityType,
      entityId: toDelete._id.toString(),
      userId: userId,
      previousState: toDelete.toObject(),
    });

    return {
      status: 'success',
      message: 'Suppression réussie',
      data: []
    };
  }
}