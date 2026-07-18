import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { PassifsService } from './passifs.service';
import { Passif } from './passifs.schema';
import { ExportService } from '../../shared/export/export.service';

const OID = (hex: string) => (hex + '0'.repeat(24)).slice(0, 24);
const USER_ID = OID('a000000000001');
const CREDITOR_ID = OID('a000000000002');
const PRODUCT_ID = OID('a000000000003');
const DEPOT_ID = OID('a000000000004');

const mockDoc = (overrides = {}) => ({
  _id: OID('aabbccddee03'),
  userId: USER_ID,
  creancierId: CREDITOR_ID,
  productId: PRODUCT_ID,
  depotId: DEPOT_ID,
  quantite: 100,
  isActive: true,
  typePassif: 'DETTE_MARCHANDISE_EN_DEPOT',
  detentaire: USER_ID,
  ayant_droit: CREDITOR_ID,
  save: jest.fn().mockResolvedValue(true),
  toObject: jest.fn(),
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockModel: any = jest.fn(() => mockDoc());
mockModel.findOne = jest.fn();
mockModel.find = jest.fn();
mockModel.findById = jest.fn();
mockModel.create = jest.fn();
mockModel.countDocuments = jest.fn();
mockModel.aggregate = jest.fn();
mockModel.sort = jest.fn().mockReturnThis();
mockModel.skip = jest.fn().mockReturnThis();
mockModel.limit = jest.fn().mockReturnThis();
mockModel.lean = jest.fn().mockReturnThis();
mockModel.populate = jest.fn().mockReturnThis();
mockModel.select = jest.fn().mockReturnThis();
mockModel.exec = jest.fn();

describe('PassifsService', () => {
  let service: PassifsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PassifsService,
        {
          provide: getModelToken(Passif.name),
          useValue: mockModel,
        },
        {
          provide: ExportService,
          useValue: {
            exportExcel: jest.fn().mockResolvedValue({}),
            exportPDF: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<PassifsService>(PassifsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addOrIncreasePassif', () => {
    it('should return null when detentaire equals creancierId', async () => {
      const result = await service.addOrIncreasePassif(
        USER_ID, DEPOT_ID, PRODUCT_ID, 50, USER_ID,
      );
      expect(result).toBeNull();
    });

    it('should increase quantity on existing passif', async () => {
      const existingDoc = mockDoc({ quantite: 100, save: jest.fn().mockResolvedValue({ quantite: 150 }) });
      mockModel.findOne.mockResolvedValue(existingDoc);

      const result = await service.addOrIncreasePassif(
        USER_ID, DEPOT_ID, PRODUCT_ID, 50, CREDITOR_ID,
      );

      expect(existingDoc.quantite).toBe(150);
      expect(existingDoc.save).toHaveBeenCalled();
      expect(mockModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Object),
          productId: expect.any(Object),
          creancierId: expect.any(Object),
        }),
      );
    });

    it('should create new passif when none exists', async () => {
      mockModel.findOne.mockResolvedValue(null);
      const newDoc = mockDoc({ save: jest.fn().mockResolvedValue({}) });
      mockModel.mockReturnValue(newDoc);

      const result = await service.addOrIncreasePassif(
        USER_ID, DEPOT_ID, PRODUCT_ID, 50, CREDITOR_ID,
      );

      expect(mockModel).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Object),
          creancierId: expect.any(Object),
          quantite: 50,
        }),
      );
      expect(newDoc.save).toHaveBeenCalled();
    });
  });

  describe('decreasePassif', () => {
    it('should decrease quantity and set inactive when zero', async () => {
      const doc = mockDoc({ quantite: 50, save: jest.fn().mockResolvedValue({ quantite: 0, isActive: false }) });
      mockModel.findOne.mockResolvedValue(doc);

      await service.decreasePassif(USER_ID, PRODUCT_ID, 50);

      expect(doc.quantite).toBe(0);
      expect(doc.isActive).toBe(false);
      expect(doc.archivedAt).toBeDefined();
      expect(doc.save).toHaveBeenCalled();
    });

    it('should do nothing when passif not found', async () => {
      mockModel.findOne.mockResolvedValue(null);

      await expect(service.decreasePassif(USER_ID, PRODUCT_ID, 50)).resolves.toBeUndefined();
    });
  });

  describe('decreasePassifByCreditor', () => {
    it('should decrease passif for specific creditor', async () => {
      const doc = mockDoc({ quantite: 100, save: jest.fn().mockResolvedValue({ quantite: 70 }) });
      mockModel.findOne.mockResolvedValue(doc);

      await service.decreasePassifByCreditor(USER_ID, PRODUCT_ID, CREDITOR_ID, 30);

      expect(doc.quantite).toBe(70);
      expect(doc.save).toHaveBeenCalled();
    });

    it('should warn and return when passif not found', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockModel.findOne.mockResolvedValue(null);

      await service.decreasePassifByCreditor(USER_ID, PRODUCT_ID, CREDITOR_ID, 30);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('transferDebtorByCreditor', () => {
    it('should transfer debt from one debtor to another', async () => {
      const docFrom = mockDoc({ quantite: 100, save: jest.fn() });
      mockModel.findOne.mockResolvedValueOnce(docFrom).mockResolvedValueOnce(null);

      await service.transferDebtorByCreditor({
        fromDebtorId: USER_ID,
        toDebtorId: OID('a00000000000b'),
        productId: PRODUCT_ID,
        creancierId: CREDITOR_ID,
        quantite: 50,
        depotId: DEPOT_ID,
      });

      expect(docFrom.quantite).toBe(50);
      expect(mockModel).toHaveBeenCalledWith(
        expect.objectContaining({ userId: expect.any(Object), quantite: 50 }),
      );
    });

    it('should do nothing when fromDebtor equals toDebtor', async () => {
      await service.transferDebtorByCreditor({
        fromDebtorId: USER_ID,
        toDebtorId: USER_ID,
        productId: PRODUCT_ID,
        creancierId: CREDITOR_ID,
        quantite: 50,
      });

      expect(mockModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('updateCreancier', () => {
    it('should decrease old creditor and add new one', async () => {
      const doc = mockDoc({ quantite: 100, save: jest.fn() });
      mockModel.findOne.mockResolvedValueOnce(doc).mockResolvedValueOnce(null);

      await service.updateCreancier(USER_ID, PRODUCT_ID, 30, CREDITOR_ID, OID('a00000000000c'));

      expect(doc.quantite).toBe(70);
    });
  });

  describe('getPassifsByUserAndSite', () => {
    it('should return passifs for user and site', async () => {
      const docs = [mockDoc()];
      const execMock = jest.fn().mockResolvedValue(docs);
      const populateMock = jest.fn().mockReturnValue({ exec: execMock });
      mockModel.find.mockReturnValue({ populate: populateMock });

      const result = await service.getPassifsByUserAndSite(USER_ID, DEPOT_ID);

      expect(result).toEqual(docs);
    });
  });

  describe('getPassifDetails', () => {
    it('should return passif when found', async () => {
      const doc = mockDoc();
      const execMock = jest.fn().mockResolvedValue(doc);
      const populate3 = jest.fn().mockReturnValue({ exec: execMock });
      const populate2 = jest.fn().mockReturnValue({ populate: populate3 });
      const populate1 = jest.fn().mockReturnValue({ populate: populate2 });
      mockModel.findById.mockReturnValue({ populate: populate1 });

      const result = await service.getPassifDetails(OID('aabbccddee01'));

      expect(result).toEqual(doc);
    });

    it('should throw NotFoundException when passif not found', async () => {
      const execMock = jest.fn().mockResolvedValue(null);
      const populate3 = jest.fn().mockReturnValue({ exec: execMock });
      const populate2 = jest.fn().mockReturnValue({ populate: populate3 });
      const populate1 = jest.fn().mockReturnValue({ populate: populate2 });
      mockModel.findById.mockReturnValue({ populate: populate1 });

      await expect(service.getPassifDetails(OID('aabbccddee02'))).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllPassifsByIdSite', () => {
    it('should return mapped passifs for a site', async () => {
      const docs = [{ quantite: 50, productId: { _id: 'prod1', productName: 'Riz' } }];
      const execMock = jest.fn().mockResolvedValue(docs);
      const selectMock = jest.fn().mockReturnValue({ exec: execMock });
      const populateMock = jest.fn().mockReturnValue({ select: selectMock });
      mockModel.find.mockReturnValue({ populate: populateMock });

      const results = await service.getAllPassifsByIdSite(DEPOT_ID);

      expect(results).toEqual([{ quantite: 50, productId: 'prod1', productName: 'Riz' }]);
    });
  });
});
