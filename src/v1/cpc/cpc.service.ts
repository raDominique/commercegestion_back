import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { BulkCreateCpcDto } from './dto/bulk-create-cpc.dto';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
const { Parser: Json2CsvParser } = require('json2csv');

@Injectable()
export class CpcService {
  constructor(
    @InjectModel(CpcProduct.name)
    private readonly model: Model<CpcProduct>,
    private readonly auditService: AuditService,
    private readonly logger: LoggerService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * Créer une nouvelle entrée CPC
   */
  async create(
    data: CreateCpcDto,
    userId: string,
  ): Promise<PaginationResult<CpcProduct>> {
    this.logger.debug('CPC', `Création du code ${data.code}`);

    const existing = await this.model.findOne({ code: data.code }).exec();
    if (existing)
      throw new BadRequestException(`Le code ${data.code} existe déjà.`);

    const created = await new this.model(data).save();

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: EntityType.CPC,
      entityId: created._id.toString(),
      userId: userId,
      newState: created.toObject(),
    });

    return {
      status: 'success',
      message: 'Code CPC créé avec succès',
      data: [created],
    };
  }

  /**
   * Récupérer tous les CPC sans pagination pour un select
   */
  async getForSelect(): Promise<{
    status: string;
    message: string;
    data: Array<{ id: string; nom: string; code: string }>;
  }> {
    const data = await this.model
      .find({})
      .select('_id nom code')
      .sort({ code: 1 })
      .exec();
    return {
      status: 'success',
      message: 'Données CPC récupérées',
      data: data.map((item: any) => ({
        id: item._id.toString(),
        nom: item.nom,
        code: item.code,
      })),
    };
  }

  /**
   * Liste paginée avec filtres
   */
  async findAll(query: any): Promise<PaginationResult<CpcProduct>> {
    const { page = 1, limit = 10, niveau, search } = query;
    const filter: any = {};
    if (niveau) filter.niveau = niveau;
    if (search) {
      filter.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort({ code: 1 })
        .exec(),
      this.model.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Données récupérées',
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Trouver les enfants directs d'un code
   */
  async findChildren(
    parentCode: string,
    query: any = {},
  ): Promise<PaginationResult<CpcProduct>> {
    const { page = 1, limit = 10 } = query;
    const [data, total] = await Promise.all([
      this.model
        .find({ parentCode })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort({ code: 1 })
        .exec(),
      this.model.countDocuments({ parentCode }),
    ]);

    return {
      status: 'success',
      message: `${total} enfant(s) trouvé(s)`,
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async findOne(code: string): Promise<PaginationResult<CpcProduct>> {
    const res = await this.model.findOne({ code }).exec();
    if (!res) throw new NotFoundException(`Code ${code} introuvable`);
    return { status: 'success', message: 'Élément trouvé', data: [res] };
  }

  async update(
    code: string,
    data: UpdateCpcDto,
    userId: string,
  ): Promise<PaginationResult<CpcProduct>> {
    const previous = await this.model.findOne({ code }).exec();
    if (!previous) throw new NotFoundException('Code introuvable');

    const updated = await this.model
      .findOneAndUpdate({ code }, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Erreur lors de la mise à jour');

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: EntityType.CPC,
      entityId: updated._id.toString(),
      userId,
      previousState: previous.toObject(),
      newState: updated.toObject(),
    });

    return {
      status: 'success',
      message: 'Mise à jour réussie',
      data: [updated],
    };
  }

  async delete(
    code: string,
    userId: string,
  ): Promise<PaginationResult<CpcProduct>> {
    const toDelete = await this.model.findOne({ code }).exec();
    if (!toDelete) throw new NotFoundException('Code introuvable');

    await this.model.deleteOne({ code }).exec();
    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: EntityType.CPC,
      entityId: toDelete._id.toString(),
      userId,
      previousState: toDelete.toObject(),
    });

    return { status: 'success', message: 'Suppression réussie', data: [] };
  }

  // ==========================================
  // LOGIQUE D'IMPORTATION
  // ==========================================

  async importCpcProduct(
    file: Express.Multer.File,
    userId: string,
  ): Promise<PaginationResult<CpcProduct>> {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    this.validateFileFormat(file.originalname);

    try {
      const results = await this.parseFile(file);
      if (!results || results.length === 0)
        throw new BadRequestException('Le fichier est vide');

      const { created, errors } = await this.processImportRows(results, userId);

      return {
        status: errors.length === 0 ? 'success' : 'partial_success',
        message: `${created.length} importés, ${errors.length} erreurs.`,
        data: created,
        ...(errors.length > 0 && { errors }),
      };
    } catch (error) {
      throw new BadRequestException(`Erreur de traitement: ${error.message}`);
    }
  }

  private validateFileFormat(originalName: string): void {
    const ext = path.extname(originalName).toLowerCase();
    if (!['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext)) {
      throw new BadRequestException(
        'Format non supporté (.xlsx ou .csv uniquement)',
      );
    }
  }

  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext.startsWith('.xl')) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    }
    return await this.parseCSV(file.buffer);
  }

  private async processImportRows(results: any[], userId: string) {
    const created: CpcProduct[] = [];
    const errors: any[] = [];

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      try {
        this.validateRowData(row);
        const formattedData = this.formatRowData(row);
        const doc = await this.model
          .findOneAndUpdate({ code: formattedData.code }, formattedData, {
            upsert: true,
            new: true,
          })
          .exec();
        created.push(doc);
      } catch (error) {
        errors.push({ ligne: i + 2, code: row.code, raison: error.message });
      }
    }
    return { created, errors };
  }

  private validateRowData(row: any): void {
    if (!row.code || !row.nom) {
      throw new Error('Champs requis manquants');
    }
  }

  private formatRowData(row: any): any {
    return {
      code: String(row.code).trim(),
      nom: String(row.nom).trim(),
      niveau: row.niveau ? String(row.niveau).trim() : 'sous-classe',
      parentCode: row.parentCode ? String(row.parentCode).trim() : null,
      ancetres:
        typeof row.ancetres === 'string'
          ? row.ancetres.split(',').map((s) => s.trim())
          : [],
      correspondances: {
        sh: row.sh ? String(row.sh).trim() : undefined,
        citi: row.citi ? String(row.citi).trim() : undefined,
        ctci: row.ctci ? String(row.ctci).trim() : undefined,
      },
    };
  }

  private parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (d) => results.push(d))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  // ==========================================
  // EXPORT ET BULK
  // ==========================================

  async exportCpc(): Promise<string> {
    const data = await this.model.find().sort({ code: 1 }).lean().exec();
    if (!data.length) throw new NotFoundException('Aucun CPC à exporter');

    const fields = ['code', 'nom', 'niveau', 'parentCode', 'correspondances'];
    const json2csv = new Json2CsvParser({ fields });
    const csvData = json2csv.parse(data);

    const fileName = `export_cpc_${Date.now()}.csv`;
    const buffer = Buffer.from(csvData, 'utf-8');

    // Création d'un faux fichier Multer pour l'UploadService
    const fakeFile = {
      buffer,
      originalname: fileName,
      mimetype: 'text/csv',
    } as any;
    return await this.uploadService.saveFile(fakeFile, 'cpc-export');
  }

  async bulkCreate(
    dto: BulkCreateCpcDto,
    userId: string,
  ): Promise<PaginationResult<CpcProduct>> {
    const created: CpcProduct[] = [];
    for (const item of dto.items) {
      const doc = await this.model
        .findOneAndUpdate({ code: item.code }, item, {
          upsert: true,
          new: true,
        })
        .exec();
      created.push(doc);
    }
    return {
      status: 'success',
      message: `${created.length} CPC traités`,
      data: created,
    };
  }
}
