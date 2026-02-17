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
import { UploadService } from 'src/shared/upload/upload.service';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { BulkCreateCpcDto } from './dto/bulk-create-cpc.dto';
const { Parser: Json2CsvParser } = require('json2csv');

@Injectable()
export class CpcService {
  constructor(
    @InjectModel(CpcProduct.name) private model: Model<CpcProduct>,
    private readonly auditService: AuditService,
    private readonly logger: LoggerService,
    private readonly uploadService: UploadService
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
  /**
     * Importer un fichier CSV de CPC
     */
  async importCpcProduct(file: Express.Multer.File, userId: string): Promise<PaginationResult<CpcProduct>> {
    // Sauvegarde du fichier via UploadService
    const fileUrl = await this.uploadService.saveFile(file, 'cpc-import');
    const filePath = path.join(process.cwd(), fileUrl.replace('/upload/', 'upload/'));

    const results: any[] = [];
    const stream = fs.createReadStream(filePath).pipe(csv());

    for await (const row of stream) {
      results.push(row);
    }

    const created: CpcProduct[] = [];
    for (const row of results) {
      const existing = await this.model.findOne({ code: row.code }).exec();
      if (existing) continue; // ignorer les doublons

      const newCpc = await new this.model(row).save();
      created.push(newCpc);

      await this.auditService.log({
        action: AuditAction.CREATE,
        entityType: 'CPC' as EntityType,
        entityId: newCpc._id.toString(),
        userId,
        newState: newCpc.toObject(),
      });
    }

    return {
      status: 'success',
      message: `${created.length} CPC importés avec succès`,
      data: created,
    };
  }

  /**
   * Exporter les CPC au format CSV
   */
  async exportCpc(): Promise<string> {
    const data = await this.model.find().sort({ code: 1 }).lean().exec();

    if (!data.length) throw new NotFoundException('Aucun CPC à exporter');

    const fields = ['code', 'nom', 'niveau', 'parentCode', 'correspondances'];
    const json2csv = new Json2CsvParser({ fields });
    const csvData = json2csv.parse(data);

    // Sauvegarde via UploadService
    const fileName = `cpc_export_${Date.now()}.csv`;
    const buffer = Buffer.from(csvData, 'utf-8');

    const fakeFile: Express.Multer.File = {
      buffer,
      originalname: fileName,
      fieldname: 'file',
      mimetype: 'text/csv',
      size: buffer.length,
      destination: '',
      filename: '',
      path: '',
      encoding: '7bit',
      stream: Readable.from(buffer),
    } as Express.Multer.File;


    const fileUrl = await this.uploadService.saveFile(fakeFile, 'cpc-export');
    return fileUrl;
  }

  async bulkCreate(dto: BulkCreateCpcDto, userId: string): Promise<PaginationResult<CpcProduct>> {
    const created: CpcProduct[] = [];

    for (const item of dto.items) {
      const existing = await this.model.findOne({ code: item.code }).exec();
      if (existing) continue; // ignorer les doublons

      const newCpc = await new this.model(item).save();
      created.push(newCpc);

      await this.auditService.log({
        action: AuditAction.CREATE,
        entityType: 'CPC' as EntityType,
        entityId: newCpc._id.toString(),
        userId,
        newState: newCpc.toObject(),
      });
    }

    return {
      status: 'success',
      message: `${created.length} CPC créés avec succès`,
      data: created,
    };
  }

}