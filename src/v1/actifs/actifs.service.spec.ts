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

  describe('getActiveDepositsAtOthers', () => {
    const me = new Types.ObjectId();
    const other = new Types.ObjectId();
    const firstFindFilter = (): Record<string, unknown> =>
      (mockModel.find.mock.calls as unknown[][])[0][0] as Record<
        string,
        unknown
      >;
    const actifLine = (detentaire: Types.ObjectId) => ({
      _id: new Types.ObjectId(),
      quantite: 10,
      quantiteEnAttente: 3,
      isActive: true,
      detentaire: { _id: detentaire },
      ayant_droit: { _id: me },
      depotId: { _id: new Types.ObjectId() },
      productId: { _id: new Types.ObjectId(), productName: 'Riz' },
    });

    it("returns the member's own stock as well as deposits at other members", async () => {
      const own = actifLine(me);
      mockModel.exec
        .mockResolvedValueOnce([own, actifLine(other)])
        // Lignes détenues par le membre sur son propre stock.
        .mockResolvedValueOnce([
          {
            depotId: own.depotId._id,
            productId: own.productId._id,
            quantite: 10,
            quantiteEnAttente: 3,
          },
        ]);

      const result = await service.getActiveDepositsAtOthers(me.toString(), {});

      const filter = firstFindFilter();
      expect(filter).not.toHaveProperty('detentaire');
      expect(filter).toEqual(
        expect.objectContaining({ userId: me, ayant_droit: me }),
      );
      expect(result.total).toBe(2);
      expect(result.data.map((d) => d.chezAutreMembre)).toEqual([false, true]);
      expect(result.data[0].quantite).toBe(7);
      expect(result.data[1].quantite).toBe(7);
      expect(result.data[1].quantiteDetenue).toBe(7);
    });

    it('keeps the held quantity on own stock after a right transfer, but caps the next transfer to own rights', async () => {
      const beneficiary = new Types.ObjectId();
      const own = {
        ...actifLine(me),
        quantite: 475000,
        quantiteEnAttente: 0,
      };
      mockModel.exec.mockResolvedValueOnce([own]).mockResolvedValueOnce([
        {
          depotId: own.depotId._id,
          productId: own.productId._id,
          ayant_droit: me,
          quantite: 475000,
          quantiteEnAttente: 0,
        },
        {
          depotId: own.depotId._id,
          productId: own.productId._id,
          ayant_droit: beneficiary,
          quantite: 25000,
          quantiteEnAttente: 0,
        },
        // Autre produit sur le même dépôt : ne doit pas être compté.
        {
          depotId: own.depotId._id,
          productId: new Types.ObjectId(),
          ayant_droit: me,
          quantite: 999,
          quantiteEnAttente: 0,
        },
      ]);

      const result = await service.getActiveDepositsAtOthers(me.toString(), {});

      const heldFilter = (mockModel.find.mock.calls as unknown[][])[1][0];
      expect(heldFilter).toEqual(
        expect.objectContaining({ userId: me, detentaire: me }),
      );
      expect(heldFilter).not.toHaveProperty('ayant_droit');
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          chezAutreMembre: false,
          quantite: 500000,
          quantiteDetenue: 500000,
          quantiteMaxTransferable: 475000,
          quantiteRestantAVirer: 475000,
        }),
      );
    });

    it('keeps only deposits at other members when onlyAtOthers is set', async () => {
      mockModel.exec.mockResolvedValueOnce([actifLine(other)]);

      await service.getActiveDepositsAtOthers(me.toString(), {
        onlyAtOthers: true,
      });

      const filter = firstFindFilter();
      expect(filter.detentaire).toEqual({ $ne: me });
      // Aucun stock propre : pas de requête des quantités détenues.
      expect(mockModel.find).toHaveBeenCalledTimes(1);
    });

    it('filters on the requested holder', async () => {
      mockModel.exec.mockResolvedValue([]);

      await service.getActiveDepositsAtOthers(me.toString(), {
        detenteurId: other.toString(),
        onlyAtOthers: true,
      });

      const filter = firstFindFilter();
      expect(filter.detentaire).toEqual(other);
    });
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
