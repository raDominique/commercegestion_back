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

  it('confirms a self-held withdrawal only once', async () => {
    const actifsService = {
      confirmPendingActif: jest.fn().mockResolvedValue(undefined),
      confirmPendingActifAtDestination: jest.fn().mockResolvedValue(undefined),
    };
    const passifsService = {
      confirmPendingPassif: jest.fn().mockResolvedValue(undefined),
    };
    const service = new TransactionsService(
      {} as any,
      actifsService as any,
      passifsService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const userId = new Types.ObjectId();

    await (service as any).applyReturnMovements({
      detentaire: userId,
      ayant_droit: userId,
      productId: new Types.ObjectId(),
      siteOrigineId: new Types.ObjectId(),
      siteDestinationId: new Types.ObjectId(),
      quantite: 250,
      prixUnitaire: 0,
      transactionNumber: 'RETRAIT-TEST',
    });

    expect(actifsService.confirmPendingActif).toHaveBeenCalledTimes(1);
    expect(passifsService.confirmPendingPassif).not.toHaveBeenCalled();
    expect(
      actifsService.confirmPendingActifAtDestination,
    ).toHaveBeenCalledTimes(1);
  });
});
