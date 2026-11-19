jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { BadRequestException } from '@nestjs/common';
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

describe('TransactionsService bulk creation', () => {
  const buildService = () =>
    new TransactionsService(
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
      {} as any,
    );

  const item = (quantite: number): any => ({ quantite });

  it('processes items sequentially and reports failures by index', async () => {
    const service = buildService();
    const calls: number[] = [];
    jest
      .spyOn(service, 'createVente')
      .mockImplementation(async (dto: any, acheteurId: string) => {
        calls.push(dto.quantite);
        expect(acheteurId).toBe('buyer-id');
        if (dto.quantite === 2) {
          throw new BadRequestException('Quantité insuffisante');
        }
        return {
          status: 'success',
          message: 'ok',
          data: [{ quantite: dto.quantite } as any],
          total: 1,
        };
      });

    const result = await service.createVenteBulk(
      { items: [item(1), item(2), item(3)] },
      'buyer-id',
    );

    expect(calls).toEqual([1, 2, 3]);
    expect(result.status).toBe('partial_success');
    expect(result.total).toBe(2);
    expect(result.data?.map((t: any) => t.quantite)).toEqual([1, 3]);
    expect(result.errors).toEqual([
      { index: 1, reason: 'Quantité insuffisante' },
    ]);
  });

  it('returns success when every item is created', async () => {
    const service = buildService();
    jest.spyOn(service, 'createDeposit').mockResolvedValue({
      status: 'success',
      message: 'ok',
      data: [{} as any],
      total: 1,
    });

    const result = await service.createDepositBulk({
      items: [item(1), item(2)],
    });

    expect(result.status).toBe('success');
    expect(result.total).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it('returns error when no item is created', async () => {
    const service = buildService();
    jest
      .spyOn(service, 'createReturn')
      .mockRejectedValue(new Error('Actif introuvable'));

    const result = await service.createReturnBulk(
      { items: [item(1)] },
      'user-id',
    );

    expect(result.status).toBe('error');
    expect(result.total).toBe(0);
    expect(result.errors).toEqual([{ index: 0, reason: 'Actif introuvable' }]);
  });
});
