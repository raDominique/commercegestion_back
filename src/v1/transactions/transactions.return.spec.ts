jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionStatus, TransactionType } from './transactions.schema';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

const id = () => new Types.ObjectId().toString();

/** Modèle Mongoose minimal : constructeur + save + find (solde déposé). */
function buildTransactionModel(findResults: { quantite: number }[][] = []) {
  const saved: any[] = [];
  const Model: any = jest.fn().mockImplementation(function (this: any, doc) {
    Object.assign(this, doc, { _id: new Types.ObjectId() });
    this.save = jest.fn().mockImplementation(() => {
      saved.push(this);
      return Promise.resolve(this);
    });
  });
  let call = 0;
  Model.find = jest.fn().mockImplementation(() => {
    const result = findResults[call++] ?? [];
    const chain: any = {
      select: () => chain,
      lean: () => chain,
      exec: () => Promise.resolve(result),
    };
    return chain;
  });
  Model.saved = saved;
  return Model;
}

function buildService(overrides: {
  transactionModel?: any;
  actifs?: Record<string, jest.Mock>;
  passifs?: Record<string, jest.Mock>;
  users?: Record<string, jest.Mock>;
  mail?: Record<string, jest.Mock>;
  notifications?: Record<string, jest.Mock>;
}) {
  const actifs = {
    reserveActif: jest.fn().mockResolvedValue(undefined),
    addOrIncreaseActifEnAttente: jest.fn().mockResolvedValue(undefined),
    addOrIncreaseActif: jest.fn().mockResolvedValue(undefined),
    confirmPendingActif: jest.fn().mockResolvedValue(undefined),
    confirmPendingActifAtDestination: jest.fn().mockResolvedValue(undefined),
    releasePendingActif: jest.fn().mockResolvedValue(undefined),
    releasePendingIncomingActif: jest.fn().mockResolvedValue(undefined),
    findOwnActifHeldByDetentaire: jest
      .fn()
      .mockResolvedValue({ quantite: 1000 }),
    findWithdrawableActifs: jest.fn().mockResolvedValue([]),
    ...overrides.actifs,
  };
  const passifs = {
    reservePassif: jest.fn().mockResolvedValue(undefined),
    confirmPendingPassif: jest.fn().mockResolvedValue(undefined),
    releasePendingPassif: jest.fn().mockResolvedValue(undefined),
    ...overrides.passifs,
  };
  const users = {
    getById: jest
      .fn()
      .mockResolvedValue({ userName: 'Rakoto', userEmail: 'r@example.test' }),
    ...overrides.users,
  };
  const mail = {
    notificationTransactionCreated: jest.fn().mockResolvedValue(undefined),
    notificationTransactionApproved: jest.fn().mockResolvedValue(undefined),
    notificationTransactionRejected: jest.fn().mockResolvedValue(undefined),
    ...overrides.mail,
  };
  const notifications = {
    notifyUser: jest.fn().mockResolvedValue(undefined),
    ...overrides.notifications,
  };
  const product = {
    findById: jest.fn().mockResolvedValue({ data: [{ productName: 'Riz' }] }),
  };
  const logger = { debug: jest.fn() };

  const service = new TransactionsService(
    overrides.transactionModel ?? buildTransactionModel(),
    actifs as any,
    passifs as any,
    product as any,
    mail as any,
    {} as any,
    users as any,
    {} as any,
    logger as any,
    {} as any,
    notifications as any,
  );
  return { service, actifs, passifs, mail, notifications };
}

/** Laisse s'exécuter les notifications « fire-and-forget ». */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Auto-retrait (détenteur = retrayant)', () => {
  const me = id();
  const siteA = id();
  const siteB = id();
  const productId = id();
  const dto = (overrides: Record<string, unknown> = {}) => ({
    detentaire: me,
    ayant_droit: me,
    productId,
    siteOrigineId: siteA,
    siteDestinationId: siteB,
    quantite: 30,
    ...overrides,
  });

  it('ne provisionne plus le site de destination à la création (pas de total doublé)', async () => {
    const model = buildTransactionModel();
    const { service, actifs, passifs } = buildService({
      transactionModel: model,
    });

    await service.createReturn(dto() as any, me);

    expect(actifs.reserveActif).toHaveBeenCalledTimes(1);
    expect(actifs.addOrIncreaseActifEnAttente).not.toHaveBeenCalled();
    expect(passifs.reservePassif).not.toHaveBeenCalled();
    expect(model.saved[0].destinationProvisioned).toBe(false);
  });

  it('accepte un stock sans dépôt préalable (ex: initialisation) si le disponible suffit', async () => {
    const model = buildTransactionModel();
    const { service, actifs } = buildService({ transactionModel: model });

    await expect(service.createReturn(dto() as any, me)).resolves.toMatchObject(
      { status: 'success' },
    );
    // Pas de contrôle d'historique de dépôts en auto-retrait
    expect(model.find).not.toHaveBeenCalled();
    expect(actifs.findOwnActifHeldByDetentaire).toHaveBeenCalledWith(
      expect.objectContaining({ minDisponible: 30 }),
    );
  });

  it('accepte le même site en auto-retrait, avec une seule réservation', async () => {
    const { service, actifs } = buildService({});

    await expect(
      service.createReturn(dto({ siteDestinationId: siteA }) as any, me),
    ).resolves.toMatchObject({ status: 'success' });
    expect(actifs.reserveActif).toHaveBeenCalledTimes(1);
    expect(actifs.addOrIncreaseActifEnAttente).not.toHaveBeenCalled();
  });

  it('refuse le même site pour un retrait chez un autre détenteur', async () => {
    const { service, actifs } = buildService({});

    await expect(
      service.createReturn(
        dto({ detentaire: id(), siteDestinationId: siteA }) as any,
        me,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(actifs.reserveActif).not.toHaveBeenCalled();
  });

  it("n'envoie qu'un email et une notification à la création", async () => {
    const { service, mail, notifications } = buildService({});

    await service.createReturn(dto() as any, me);
    await flush();

    expect(mail.notificationTransactionCreated).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledTimes(1);
  });

  it("n'envoie qu'un email et une notification à l'approbation et au rejet", async () => {
    const { service, mail, notifications } = buildService({});
    const transaction: any = {
      transactionNumber: 'T-1',
      type: TransactionType.RETRAIT,
      initiatorId: new Types.ObjectId(me),
      recipientId: new Types.ObjectId(me),
      productId: new Types.ObjectId(productId),
      quantite: 30,
    };

    await (service as any).sendApprovalNotification(transaction, me);
    await (service as any).sendRejectionNotification(transaction, 'motif', me);
    await flush();

    expect(mail.notificationTransactionApproved).toHaveBeenCalledTimes(1);
    expect(mail.notificationTransactionRejected).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUser).toHaveBeenCalledTimes(2);
  });

  it("alimente la destination une seule fois, à l'approbation", async () => {
    const { service, actifs } = buildService({});
    const meId = new Types.ObjectId(me);

    await (service as any).applyReturnMovements({
      detentaire: meId,
      ayant_droit: meId,
      productId: new Types.ObjectId(productId),
      siteOrigineId: new Types.ObjectId(siteA),
      siteDestinationId: new Types.ObjectId(siteB),
      quantite: 30,
      prixUnitaire: 0,
      destinationProvisioned: false,
      transactionNumber: 'T-1',
    });

    expect(actifs.confirmPendingActif).toHaveBeenCalledTimes(1);
    expect(actifs.addOrIncreaseActif).toHaveBeenCalledTimes(1);
    expect(actifs.addOrIncreaseActif).toHaveBeenCalledWith(
      me,
      siteB,
      productId,
      30,
      0,
      me,
      me,
    );
    expect(actifs.confirmPendingActifAtDestination).not.toHaveBeenCalled();
  });

  it("même site : l'approbation retire puis remet q une seule fois (solde inchangé)", async () => {
    const { service, actifs } = buildService({});
    const meId = new Types.ObjectId(me);

    await (service as any).applyReturnMovements({
      detentaire: meId,
      ayant_droit: meId,
      productId: new Types.ObjectId(productId),
      siteOrigineId: new Types.ObjectId(siteA),
      siteDestinationId: new Types.ObjectId(siteA),
      quantite: 30,
      prixUnitaire: 0,
      destinationProvisioned: false,
      transactionNumber: 'T-SAME',
    });

    expect(actifs.confirmPendingActif).toHaveBeenCalledTimes(1);
    expect(actifs.confirmPendingActif).toHaveBeenCalledWith(
      me,
      siteA,
      productId,
      30,
      { detentaireId: me, ayantDroitId: me },
    );
    expect(actifs.addOrIncreaseActif).toHaveBeenCalledTimes(1);
    expect(actifs.addOrIncreaseActif).toHaveBeenCalledWith(
      me,
      siteA,
      productId,
      30,
      0,
      me,
      me,
    );
  });

  it("garde l'ancienne logique pour un retrait créé avant la correction", async () => {
    const { service, actifs } = buildService({});
    const meId = new Types.ObjectId(me);

    await (service as any).applyReturnMovements({
      detentaire: meId,
      ayant_droit: meId,
      productId: new Types.ObjectId(productId),
      siteOrigineId: new Types.ObjectId(siteA),
      siteDestinationId: new Types.ObjectId(siteB),
      quantite: 30,
      prixUnitaire: 0,
      // destinationProvisioned absent
      transactionNumber: 'T-OLD',
    });

    expect(actifs.confirmPendingActifAtDestination).toHaveBeenCalledTimes(1);
    expect(actifs.addOrIncreaseActif).not.toHaveBeenCalled();
  });
});

describe('Retrait intégral par détenteur', () => {
  const me = id();
  const holder = id();
  const siteY1 = id();
  const siteY2 = id();
  const dest = id();
  const riz = id();
  const mais = id();
  const cafe = id();

  const actif = (productId: string, siteId: string, quantite: number) => ({
    _id: new Types.ObjectId(),
    productId: { _id: new Types.ObjectId(productId), productName: 'P' },
    depotId: { _id: new Types.ObjectId(siteId), siteName: 'S' },
    quantite,
    quantiteEnAttente: 0,
    prixUnitaire: 100,
  });

  it('calcule la quantité retirable (min disponible / solde déposé) et exclut les actifs sans dépôt', async () => {
    // getSoldeDepose est appelé une fois par actif : [dépôts, retraits]
    const model = buildTransactionModel([
      [{ quantite: 50 }], // riz : déposé 50
      [{ quantite: 20 }], // riz : retiré 20 → solde 30
      [{ quantite: 10 }], // maïs : déposé 10
      [], // maïs : rien retiré → solde 10
      [], // café : aucun dépôt (reçu par virement)
      [],
    ]);
    const { service } = buildService({
      transactionModel: model,
      actifs: {
        findWithdrawableActifs: jest
          .fn()
          .mockResolvedValue([
            actif(riz, siteY1, 40),
            actif(mais, siteY2, 25),
            actif(cafe, siteY1, 5),
          ]),
      },
    });

    const { retirables, exclues } = await service.computeWithdrawable(
      me,
      holder,
    );

    expect(retirables.map((p) => [p.productId, p.quantiteRetirable])).toEqual([
      [riz, 30],
      [mais, 10],
    ]);
    expect(exclues).toHaveLength(1);
    expect(exclues[0].productId).toBe(cafe);
  });

  it('crée un retrait par position retirable et rapporte les échecs par position', async () => {
    const { service } = buildService({});
    jest.spyOn(service, 'computeWithdrawable').mockResolvedValue({
      retirables: [
        {
          actifId: 'a1',
          productId: riz,
          productName: 'Riz',
          siteOrigineId: siteY1,
          siteName: 'Y1',
          detentaireId: holder,
          disponible: 30,
          soldeDepose: 30,
          quantiteRetirable: 30,
          prixUnitaire: 100,
        },
        {
          actifId: 'a2',
          productId: mais,
          productName: 'Maïs',
          siteOrigineId: dest,
          siteName: 'Dest',
          detentaireId: holder,
          disponible: 10,
          soldeDepose: 10,
          quantiteRetirable: 10,
          prixUnitaire: 100,
        },
      ],
      exclues: [],
    });
    const createReturn = jest
      .spyOn(service, 'createReturn')
      .mockImplementation((dto: any) =>
        dto.siteOrigineId === dto.siteDestinationId
          ? Promise.reject(new BadRequestException('même site'))
          : Promise.resolve({
              status: 'success',
              message: 'ok',
              data: [{ productId: dto.productId } as any],
            }),
      );

    const result = await service.createReturnAll(
      { detentaireId: holder, siteDestinationId: dest },
      me,
    );

    expect(createReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        detentaire: holder,
        ayant_droit: me,
        productId: riz,
        siteOrigineId: siteY1,
        siteDestinationId: dest,
        quantite: 30,
      }),
      me,
    );
    expect(result.status).toBe('partial_success');
    expect(result.errors).toEqual([
      { index: 1, id: 'a2', reason: 'même site' },
    ]);
  });

  it('refuse quand aucune position ne peut être retirée', async () => {
    const { service } = buildService({});
    jest
      .spyOn(service, 'computeWithdrawable')
      .mockResolvedValue({ retirables: [], exclues: [] });

    await expect(
      service.createReturnAll(
        { detentaireId: holder, siteDestinationId: dest },
        me,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Statut des transactions inchangé', () => {
  it('le retrait reste PENDING à la création', async () => {
    const me = id();
    const model = buildTransactionModel();
    const { service } = buildService({ transactionModel: model });

    await service.createReturn(
      {
        detentaire: me,
        ayant_droit: me,
        productId: id(),
        siteOrigineId: id(),
        siteDestinationId: id(),
        quantite: 1,
      } as any,
      me,
    );

    expect(model.saved[0].status).toBe(TransactionStatus.PENDING);
  });
});
