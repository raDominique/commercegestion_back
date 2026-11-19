import { ApiResponseOptions } from '@nestjs/swagger';
import { BULK_MAX_ITEMS } from './bulk.helper';

/** Description Swagger commune aux endpoints bulk. */
export const bulkDescription = (what: string, singleEndpoint?: string) =>
  `${what}${singleEndpoint ? ` — version bulk de \`${singleEndpoint}\`` : ''}.

Body: 1 à ${BULK_MAX_ITEMS} éléments${singleEndpoint ? ", chacun au même format et avec les mêmes règles que l'endpoint unitaire" : ''}.

Traitement:
- Les éléments sont traités **dans l'ordre**, un par un.
- Un élément en échec **n'annule pas** les autres : il est listé dans \`errors\` avec son \`index\` (et son \`id\` pour une liste d'ids).
- \`status\`: \`success\` (tout réussi), \`partial_success\` (au moins un échec), \`error\` (aucune réussite).
- Un body mal formé (validation) rejette toute la requête en 400 avant traitement.`;

export const BULK_RESPONSE_OK: ApiResponseOptions = {
  description: 'Lot traité. Réussites dans `data`, échecs dans `errors`.',
  schema: {
    example: {
      status: 'partial_success',
      message: '1 réussite(s), 1 échec(s) sur 2',
      data: [{ _id: '507f1f77bcf86cd799439011' }],
      total: 1,
      errors: [
        {
          index: 1,
          id: '507f1f77bcf86cd799439012',
          reason: 'Introuvable',
        },
      ],
    },
  },
};

export const BULK_RESPONSE_400: ApiResponseOptions = {
  status: 400,
  description:
    'Liste invalide (vide, trop longue, doublon ou élément invalide)',
};
