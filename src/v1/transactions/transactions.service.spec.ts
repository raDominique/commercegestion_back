jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { Types } from 'mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionStatus } from './transactions.schema';

describe('TransactionsService approval', () => {
  it('keeps a transaction pending when its accounting movements fail', async () => {
    const transaction: any = {
      status: TransactionStatus.PENDING,
      save: jest.fn(),
    };
    const transactionModel: any = {
      findById: jest.fn().mockResolvedValue(transaction),
    };
    const service = new TransactionsService(
      transactionModel,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn(service as any, 'applyTransactionMovements')
      .mockRejectedValue(new Error('Impossible de créer les écritures'));

    await expect(
      service.approveTransaction('transaction-id', {
        approuveurId: new Types.ObjectId().toString(),
      }),
    ).rejects.toThrow('Impossible de créer les écritures');

    expect(transaction.save).not.toHaveBeenCalled();
  });
});
