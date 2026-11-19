jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { StockService } from './stock.service';
import { MovementType, StockMovementDocument } from './stock-movement.schema';
import { CreateMovementDto } from './dto/create-movement.dto';

const movement = (quantite: number) => ({ quantite }) as CreateMovementDto;

describe('StockService bulk', () => {
  const buildService = () =>
    Object.create(StockService.prototype) as StockService;

  it('creates each movement with the same type and operator, in order', async () => {
    const service = buildService();
    const createMovement = jest
      .spyOn(service, 'createMovement')
      .mockImplementation((dto: CreateMovementDto) =>
        dto.quantite === 2
          ? Promise.reject(
              new Error(
                "Le site d'origine et le site de destination ne peuvent pas être les mêmes.",
              ),
            )
          : Promise.resolve({
              quantite: dto.quantite,
            } as unknown as StockMovementDocument),
      );

    const result = await service.createMovementsBulk(
      { items: [movement(1), movement(2), movement(3)] },
      'operator-id',
      MovementType.TRANSFERT,
    );

    const calls = createMovement.mock.calls as [
      CreateMovementDto,
      string,
      MovementType,
    ][];
    expect(
      calls.map(([dto, user, type]) => [dto.quantite, user, type]),
    ).toEqual([
      [1, 'operator-id', MovementType.TRANSFERT],
      [2, 'operator-id', MovementType.TRANSFERT],
      [3, 'operator-id', MovementType.TRANSFERT],
    ]);
    expect(result.status).toBe('partial_success');
    expect(result.total).toBe(2);
    expect(result.errors).toEqual([
      {
        index: 1,
        reason:
          "Le site d'origine et le site de destination ne peuvent pas être les mêmes.",
      },
    ]);
  });

  it('flags each movement with the shared reason and reports unknown ids', async () => {
    const service = buildService();
    const flag = jest
      .spyOn(service, 'flagMovement')
      .mockImplementation((id: string) =>
        id === 'missing'
          ? Promise.reject(new Error('Mouvement non trouvé'))
          : Promise.resolve({ status: 'success', data: { _id: id } }),
      );

    const result = await service.flagMovementsBulk(
      { ids: ['m1', 'missing'], reason: 'Quantité douteuse' },
      'user-id',
    );

    expect(flag).toHaveBeenCalledWith('m1', 'user-id', 'Quantité douteuse');
    expect(result.data).toEqual([{ _id: 'm1' }]);
    expect(result.errors).toEqual([
      { index: 1, id: 'missing', reason: 'Mouvement non trouvé' },
    ]);
  });
});
