jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ActifsService } from './actifs.service';
import { Actif } from './actifs.schema';
import { Transaction } from '../transactions/transactions.schema';
import { ProductService } from '../products/products.service';
import { ExportService } from '../../shared/export/export.service';

describe('ActifsService', () => {
  let service: ActifsService;

  const mockModel = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActifsService,
        {
          provide: getModelToken(Actif.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Transaction.name),
          useValue: mockModel,
        },
        {
          provide: ProductService,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
          },
        },
        {
          provide: ExportService,
          useValue: {
            exportExcel: jest.fn(),
            exportPDF: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ActifsService>(ActifsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not count the owner and holder mirror lines of a deposit twice', async () => {
    const productId = new Types.ObjectId();
    const detentaireId = new Types.ObjectId();
    const ayantDroitId = new Types.ObjectId();
    mockModel.exec.mockResolvedValue([
      {
        quantite: 250,
        quantiteEnAttente: 0,
        detentaire: detentaireId,
        ayant_droit: ayantDroitId,
        productId: { _id: productId, productName: 'Produit test' },
      },
      {
        quantite: 250,
        quantiteEnAttente: 0,
        detentaire: detentaireId,
        ayant_droit: ayantDroitId,
        productId: { _id: productId, productName: 'Produit test' },
      },
    ]);

    await expect(
      service.getAllActifsByIdSite(new Types.ObjectId().toString()),
    ).resolves.toEqual([
      {
        quantite: 250,
        productId,
        productName: 'Produit test',
      },
    ]);
  });
});
