import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getErrorReason, runBulk } from './bulk.helper';

describe('runBulk', () => {
  it('runs items in order and keeps going after a failure', async () => {
    const order: number[] = [];
    const result = await runBulk([1, 2, 3], (n) => {
      order.push(n);
      if (n === 2) {
        return Promise.reject(new BadRequestException('deux refusé'));
      }
      return Promise.resolve(n * 10);
    });

    expect(order).toEqual([1, 2, 3]);
    expect(result).toEqual({
      status: 'partial_success',
      message: '2 réussite(s), 1 échec(s) sur 3',
      data: [10, 30],
      total: 2,
      errors: [{ index: 1, reason: 'deux refusé' }],
    });
  });

  it('does not start an item before the previous one has finished', async () => {
    let running = 0;
    let maxRunning = 0;
    await runBulk([1, 2, 3], async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setImmediate(resolve));
      running--;
    });
    expect(maxRunning).toBe(1);
  });

  it('reports the id when idOf is given', async () => {
    const result = await runBulk(
      ['a', 'b'],
      (id) =>
        id === 'b'
          ? Promise.reject(new NotFoundException('Introuvable'))
          : Promise.resolve(id),
      { idOf: (id) => id },
    );
    expect(result.errors).toEqual([
      { index: 1, id: 'b', reason: 'Introuvable' },
    ]);
  });

  it('returns success / error statuses', async () => {
    const ok = await runBulk([1], (n) => Promise.resolve(n));
    expect(ok.status).toBe('success');
    const failed = await runBulk([1], () => Promise.reject(new Error('boom')));
    expect(failed.status).toBe('error');
    expect(failed.total).toBe(0);
  });
});

describe('getErrorReason', () => {
  it('joins Nest validation message arrays', () => {
    expect(
      getErrorReason(new BadRequestException(['a est requis', 'b invalide'])),
    ).toBe('a est requis, b invalide');
  });

  it('handles non-Error values', () => {
    expect(getErrorReason('oops')).toBe('oops');
  });
});
