import { HttpException } from '@nestjs/common';

/** Nombre maximal d'éléments acceptés par une requête bulk. */
export const BULK_MAX_ITEMS = 100;

/** Échec d'un élément d'une requête bulk. */
export interface BulkError {
  /** Position de l'élément dans `items` / `ids`. */
  index: number;
  /** Identifiant concerné, pour les opérations sur une liste d'ids. */
  id?: string;
  reason: string;
}

/** Résultat d'une opération bulk : réussites dans `data`, échecs dans `errors`. */
export interface BulkResult<T> {
  status: 'success' | 'partial_success' | 'error';
  message: string;
  data: T[];
  total: number;
  errors: BulkError[];
}

/**
 * Applique `handler` à chaque élément, l'un après l'autre.
 *
 * Séquentiel volontairement : les opérations métier (réservations d'actifs,
 * quantités en vente, contenu du panier) dépendent de l'état laissé par
 * l'élément précédent. Un échec n'interrompt pas le lot ; il est rapporté
 * dans `errors` avec l'index (et l'id si `idOf` est fourni).
 */
export async function runBulk<I, R>(
  items: I[],
  handler: (item: I, index: number) => Promise<R>,
  options: { idOf?: (item: I) => string } = {},
): Promise<BulkResult<R>> {
  const data: R[] = [];
  const errors: BulkError[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    try {
      data.push(await handler(item, index));
    } catch (error) {
      errors.push({
        index,
        ...(options.idOf ? { id: options.idOf(item) } : {}),
        reason: getErrorReason(error),
      });
    }
  }

  const status = !errors.length
    ? 'success'
    : data.length
      ? 'partial_success'
      : 'error';

  return {
    status,
    message: `${data.length} réussite(s), ${errors.length} échec(s) sur ${items.length}`,
    data,
    total: data.length,
    errors,
  };
}

/** Message lisible d'une erreur (y compris les messages de validation Nest). */
export function getErrorReason(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null) {
      const message = (response as { message?: unknown }).message;
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string') return message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
