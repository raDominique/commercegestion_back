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

  it('uses the holder mirror when selling stock owned by an ayant droit', async () => {
    const holderMirror = {
      quantite: 8000,
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(holderMirror);

    await service.decreaseActifForVente(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
      2000,
    );

    expect(holderMirror.quantite).toBe(6000);
    expect(holderMirror.save).toHaveBeenCalledTimes(1);
    expect(mockModel.findOne).toHaveBeenCalledTimes(2);
    expect(mockModel.findOne.mock.calls[1][0]).toEqual(
      expect.objectContaining({ ayant_droit: expect.any(Types.ObjectId) }),
    );
  });

  it('does not use a holder mirror for the standard stock decrease flow', async () => {
    mockModel.findOne.mockResolvedValue(null);

    await expect(
      service.decreaseActif(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        1,
      ),
    ).rejects.toThrow('Stock insuffisant ou actif inexistant');

    expect(mockModel.findOne).toHaveBeenCalledTimes(1);
    expect(mockModel.findOne.mock.calls[0][0]).not.toHaveProperty(
      'ayant_droit',
    );
  });
});
