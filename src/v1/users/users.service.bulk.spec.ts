jest.mock('@faker-js/faker', () => ({ faker: {} }));

import { UsersService } from './users.service';

describe('UsersService bulk admin actions', () => {
  it('refuses to delete the current admin but deletes the others', async () => {
    const service = Object.create(UsersService.prototype) as UsersService;
    const remove = jest.spyOn(service, 'remove').mockResolvedValue({
      status: 'success',
      message: 'Supprimé',
      data: null,
    });

    const result = await service.removeBulk(['admin', 'u1', 'u2'], 'admin');

    expect(remove.mock.calls.map(([id]) => id)).toEqual(['u1', 'u2']);
    expect(result.status).toBe('partial_success');
    expect(result.data).toEqual([{ id: 'u1' }, { id: 'u2' }]);
    expect(result.errors).toEqual([
      {
        index: 0,
        id: 'admin',
        reason: 'Vous ne pouvez pas supprimer votre propre compte admin.',
      },
    ]);
  });
});
