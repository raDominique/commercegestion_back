import { Types } from 'mongoose';
import { LedgerDisplayService } from './ledger-display.service';
import {
  TransactionStatus,
  TransactionType,
} from '../transactions/transactions.schema';

describe('LedgerDisplayService', () => {
  it('shows a pending withdrawal in the owner asset and liability ledgers', async () => {
    const userId = new Types.ObjectId();
    const transactionModel = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          transactionNumber: 'RETRAIT-TEST',
          type: TransactionType.RETRAIT,
          status: TransactionStatus.PENDING,
          quantite: 75,
          createdAt: new Date('2026-09-26T12:00:00.000Z'),
          initiatorId: {
            _id: userId,
            userFirstname: 'RAMAHEFARSON',
            userName: 'Test',
          },
          recipientId: { _id: new Types.ObjectId() },
          detentaire: { _id: new Types.ObjectId(), userName: 'Domi' },
          productId: { productName: 'Riz', codeCPC: '01140' },
          siteOrigineId: { siteName: 'Hangar A' },
          siteDestinationId: { siteName: 'Hangar B' },
        },
      ]),
    };
    const service = new LedgerDisplayService(
      transactionModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const ledger = await service.getUserLedger(userId.toString());

    expect(ledger.movements.actifs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'RETRAIT (EN ATTENTE)',
          quantity: -75,
          isPending: true,
        }),
      ]),
    );
    expect(ledger.movements.passifs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'RETRAIT (ANNULATION DETTE EN ATTENTE)',
          quantity: -75,
          isPending: true,
        }),
      ]),
    );
  });
});
