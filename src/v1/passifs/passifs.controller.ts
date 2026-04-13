import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PassifsService } from './passifs.service';
import { Auth } from '../auth';

@ApiTags('Passifs')
@Controller()
export class PassifsController {
  constructor(private readonly passifsService: PassifsService) {}

  @Get(':id')
  @Auth()
  @ApiOperation({
    summary: 'Détails complets d\'un passif (obligation/dette)',
    description: `Récupère les informations détaillées d\'un PASSIF spécifique: une obligation de rembourser une marchandise.

Définition PASSIF:\n- Ressource NÉGATIVE au bilan
- Obligation/Dette de l\'utilisateur
- Marchandise que je dois RENDRE
- Prêt que je dois REMBOURSER
- Au PASSIF du bilan comptable

Création d\'un passif:\nUn passif est créé quand:\n1. Je REÇOIS un DÉPÔT: Quelqu\'un me confie 100 unités\n   → J\'ai un ACTIF: +100 (je possède les produits)\n   → J\'ai un PASSIF: +100 (je dois les rendre)\n2. J\'EMPRUNTE une marchandise\n3. J\'ACHÈTE à crédit (dette à payer)\n4. VIREMENT de propriété sans mouvement physique\n\nContenu retourné:\n- Produit due: ID, nom, description, référence\n- Créancier: QUI doit recevoir la marchandise (propriétaire original)\n- Détenteur ACTUEL: MOI (qui doit rendre)\n- Quantité RESTANTE due: Combien je dois encore\n- Quantité REMBOURSÉE: Combien j\'ai déjà rendu\n- Valeur unitaire (prix)\n- Valeur TOTALE de la dette\n- Statut: ACTIF (impayé), PARTIELLEMENT_REMBOURSÉ, CLÔTURÉ\n- Date de création: Quand la dette a commencé\n- Date d\'échéance: Deadline pour rembourser (si applicable)\n- Historique: Tous les remboursements partiels\n\nCas d\'usage:\n- Consultation personnelle: \"Qu\'est-ce que je dois à qui?\"\n- Trésorerie: Am-je solvable? Risque de défaut?\n- Remboursement: Avant de rendre les produits\n- Audit: Réconciliation dettes ↔ registre\n- Suivi crédit: Ratio endettement\n- Négociation: Demander délai de paiement\n- Contentieux: Preuve de la dette (si contestée)\n\nRisque de crédit:\n- Évalué par: Quantité Passifs / Quantité Actifs\n- Si ratio > 1 = Je dois PLUS que je ne possède (critique!)\n- Si ratio > 0.5 = Je dois la moitié (vigilance)\n- Si ratio < 0.1 = Je dois très peu (sain)\n\nRemboursement:\n- Peut être TOTAL: Je rends tout d\'un coup\n- Ou PARTIEL: Je rends petit à petit\n- Chaque remboursement RÉDUIT le passif\n- Quand quantité = 0 → Passif CLÔTURÉ\n\nErreurs possibles:\n- 401: Non authentifié\n- 403: Pas d\'accès à ce passif (ne le concerne pas)\n- 404: Passif non trouvé`,
  })
  @ApiResponse({
    status: 200,
    description: 'Détails complets du passif avec créancier, quantité due et remboursements',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439060',
        productId: '507f1f77bcf86cd799439030',
        productName: 'Ciment Portland 42,5',
        codeCPC: 'MAT-001',
        creditorId: '507f1f77bcf86cd799439001',
        creditorName: 'Alice Dupont',
        holderId: '507f1f77bcf86cd799439002',
        holderName: 'Bob Martin (moi)',
        quantityDue: 500,
        quantityRemboursed: 200,
        quantityRemaining: 300,
        prixUnitaire: 50,
        valueTotalDue: 25000,
        valueRemaining: 15000,
        status: 'ACTIF',
        createdAt: '2026-04-01T10:30:45.000Z',
        dueDate: '2026-05-01T00:00:00.000Z',
        remboursements: [
          {
            date: '2026-04-10T14:30:00.000Z',
            quantityRemboursed: 100,
            reference: 'RETOUR-001',
          },
          {
            date: '2026-04-15T09:15:00.000Z',
            quantityRemboursed: 100,
            reference: 'RETOUR-002',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Pas d\'accès à ce passif' })
  @ApiResponse({ status: 404, description: 'Passif non trouvé' })
  async findOne(@Param('id') id: string) {
    return this.passifsService.getPassifDetails(id);
  }

  @Get('all-by-site/:siteId')
  @Auth()
  @ApiOperation({
    summary: 'Récupère tous les passifs d\'un site pour un select2',
    description: `Récupère tous les passifs (dettes) disponibles sur un site sans pagination.
    
Retourne:
- quantite: Quantité due/restante
- productId: ID du produit
- productName: Nom du produit

Utilisation: Remplir des listes déroulantes (select2) pour les dettes

Conditions:
- Site valide
- Passifs actifs (isActive = true)
- Quantité > 0`,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste de tous les passifs du site',
    schema: {
      example: [
        {
          quantite: 300,
          productId: '507f1f77bcf86cd799439030',
          productName: 'Ciment Portland 42,5',
        },
        {
          quantite: 500,
          productId: '507f1f77bcf86cd799439031',
          productName: 'Gravier 0-20 mm',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Site non trouvé' })
  async getAllPassifsByIdSite(@Param('siteId') siteId: string) {
    return this.passifsService.getAllPassifsByIdSite(siteId);
  }
}
