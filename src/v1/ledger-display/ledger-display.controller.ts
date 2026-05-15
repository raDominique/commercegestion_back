import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LedgerDisplayService } from './ledger-display.service';
import { Auth } from '../auth';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@ApiTags('Livre')
@Controller()
export class LedgerDisplayController {
  constructor(private readonly ledgerDisplayService: LedgerDisplayService) {}

  /**
   * Affiche le grand livre pour un utilisateur spécifique
   */
  @Get('user/:userId')
  @Auth()
  @ApiOperation({
    summary: "Grand livre complet d'un utilisateur",
    description: `Affiche le grand livre (ledger) récapitulatif de TOUS les mouvements d'actifs et de passifs pour un utilisateur spécifique.

Contenu:
- Actifs: Tous les produits que l'utilisateur possède ou détient
  - Quantité par produit
  - Valeur unitaire et totale
  - Statut (actif, inactif)
  - Provenance (initialisé, reçu, acheté, etc.)

- Passifs: Toutes les dettes/obligations de l'utilisateur
  - Marchandises dues à d'autres
  - Quantités dues par produit
  - Créancier (qui doit recevoir)
  - Provenance du passif
  - Status de remboursement (partiel, complet)

- Mouvements: Historique complet des transactions
  - Dépôts reçus
  - Retraits effectués
  - Transferts de propriété
  - Virements
  - Validations/rejets

Utilisation:
- Audit interne: État financier complet
- Réconciliation: Vérifier conformité registres ↔ système
- Reporting: Bilan par utilisateur
- Suivi solvabilité: Actifs vs Passifs
- Contrôle gestion: Performance utilisateur

Interprétation:
- Balance positive = plus de dettes que d'actifs (sain)
- Balance négative = plus d'actifs que de dettes (risque crédit)

Note: Cet endpoint retourne TOUS les mouvements. Pour un historique limité ou filtré, utiliser les endpoints spécialisés (actifs/, passifs/, product/).

Erreurs possibles:
- 401: Non authentifié
- 404: Utilisateur non trouvé`,
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description:
      "Grand livre complet: actifs, passifs et mouvements de l'utilisateur",
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getUserLedger(@Param('userId') userId: string) {
    if (!userId || userId.length !== 24) {
      throw new BadRequestException('Un ID utilisateur valide est requis');
    }

    const ledger = await this.ledgerDisplayService.getUserLedger(userId);

    return {
      status: 'success',
      message: `Grand livre pour l'utilisateur ${ledger.userName}`,
      data: {
        info: {
          userId: ledger.userId,
          userName: ledger.userName,
          generatedAt: new Date(),
        },
        // On sépare pour que le front puisse faire deux onglets
        movements: {
          actifs: ledger.movements.actifs,
          passifs: ledger.movements.passifs,
          // Optionnel: Liste consolidée pour un flux global
          all: [...ledger.movements.actifs, ...ledger.movements.passifs].sort(
            (a, b) => b.dateTime.getTime() - a.dateTime.getTime(),
          ),
        },
      },
    };
  }

  /**
   * Affiche le grand livre global (tous les mouvements du système)
   */
  @Get('global')
  @Auth()
  @ApiOperation({
    summary: 'Grand livre global du système',
    description: `Affiche le grand livre GLOBAL: tous les mouvements de TOUS les utilisateurs du système avec pagination.

Contenu:
- Chaque mouvement enregistre:
  - Produit: ID, nom, référence
  - Type: TRANSFERT, VIREMENT, INITIALISATION, DÉPÔT, RETRAIT
  - Quantité manipulée
  - Initiateur (qui a créé le mouvement)
  - Destinataire/Propriétaire actuel
  - Date/heure exact du mouvement
  - Validateur (qui a approuvé)
  - Status: PENDING, VALIDATED, FLAGGED, REJECTED

- Statistiques globales:
  - Volume total de mouvements
  - Nombre de transactions par type
  - Utilisateurs actifs
  - Produits les plus mouvementés

Utilisation:
- Audit groupe: Vue d'ensemble système
- Conformité: Tracer tous les mouvements
- Détection fraude: Identifier anomalies globales
- Reporting direction: Performance globale
- BigData: Analyse tendances
- Réconciliation groupe: Tous les comptes

Pagination:
- page: numéro de page (défaut: 1)
- limit: mouvements par page (défaut: 50, max: 500)

Tri: Par date décroissante (les plus récents d'abord)

Note: Utilisateur Normal ne voit que ses propres mouvements (getUserLedger). Cet endpoint est ADMIN uniquement.

Erreurs possibles:
- 400: Paramètres pagination invalides
- 401: Non authentifié
- 403: Pas permissions admin`,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'éléments par page (défaut: 50)",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Grand livre global avec tous les mouvements du système',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Pas permissions admin' })
  async getGlobalLedger(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.ledgerDisplayService.getGlobalLedger(page, limit);
  }

  /**
   * Affiche les mouvements d'un produit spécifique
   */
  @Get('product/:productId')
  @Auth()
  @ApiOperation({
    summary: "Historique complet d'un produit",
    description: `Affiche TOUS les mouvements concernant un produit spécifique (identification complète du flux du produit).

Contenu:
- Flux entrant:
  - Initialisation: quantité et date
  - Dépôts reçus: de qui, quantité, quand
  - Retours: d'où, quantité, quand
  - Transferts entrant: ancien détenteur, nouvelle quantité

- Flux sortant:
  - Retraits: quantité, destination, quand
  - Dépôts envoyés (pour suivre): à qui, quantité, quand
  - Transferts sortant: nouveau détenteur, quantité

- Propriété:
  - Propriétaire original (initialisateur)
  - Modifications de propriété (virements)
  - Détenteurs successifs
  - Saisi/Libération (si applicable)

- Qualité:
  - Mouvements validés
  - Mouvements signalés/suspects (FLAGGED)
  - Mouvements rejetés (non comptabilisés)

Utilisation:
- Traçabilité produit: chaîne complète fournisseur → client
- Contrôle qualité: tous les mouvements, incidents
- Comptabilité: coûts, débits/crédits
- Inventaire: justification quantités
- Suivi stock: là où est le produit MAINTENANT
- Audit: tous les intervenants

Propriété des données:
- Avec userId: voit UNIQUEMENT les mouvements concernant cet utilisateur pour ce produit
- Sans userId: voit TOUS les mouvements du produit (Admin)

Exemple pratique:
- Initialisation: 1000 unités le 01/01
- Dépôt à Alice: 400 le 05/01
- Dépôt à Bob: 300 le 10/01
- Retrait initial: 300 le 20/01
- → Produit actuellement: 100 unités chez propriétaire

Erreurs possibles:
- 400: Pas de mouvements pour ce produit
- 401: Non authentifié
- 403: Pas d'accès à cet utilisateur (sans permission)
- 404: Produit non trouvé`,
  })
  @ApiParam({
    name: 'productId',
    description: 'ID unique du produit',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: "Filtrer par ID d'utilisateur (optionnel)",
  })
  @ApiResponse({
    status: 200,
    description: 'Mouvements complets du produit',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  async getProductMovements(
    @Param('productId') productId: string,
    @Query('userId') userId?: string,
  ) {
    if (!productId) {
      throw new BadRequestException('productId is required');
    }
    return this.ledgerDisplayService.getProductMovements(productId, userId);
  }

  /**
   * Affiche la fiche de stock pour un produit
   */
  @Get('stock-card/:userId/:productId')
  @Auth()
  @ApiOperation({
    summary: 'Fiche de stock détaillée (Stock card)',
    description: `Affiche la FICHE DE STOCK (stock card) détaillée pour un produit et un utilisateur: récapitulatif complet du mouvement du produit.

Contenu standard de fiche de stock:
- EN-TÊTE:
  - Produit: ID, nom, référence, description
  - Période d'analyse (date début-fin)
  - Utilisateur propriétaire/détenteur
  - Valeur unitaire (prix FIFO/LIFO)

- STOCK INITIAL:
  - Quantité au début de période
  - Valeur initiale

- MOUVEMENTS (tableau détaillé):
  - Date | Référence | Type | Quantité Entrée | Quantité Sortie | Solde | Valeur
  - ENTR: Dépôt reçu | 100 | - | 100 | 250€
  - SORT: Retrait | - | 40 | 60 | 150€
  - INIT: Initialisation | 200 | - | 260 | 650€

- STOCK FINAL:
  - Quantité clôture
  - Valeur clôture
  - Variation période

- STATISTIQUES:
  - Rotation: nombre de mouvements
  - Entrées totales
  - Sorties totales
  - Stock moyen
  - Valeur moyenne

- ALERTES:
  - Mouvements suspects (FLAGGED)
  - Discordances
  - Anomalies détectées

Utilisation:
- Comptabilité: Justifier valeur stock fiche de paie
- Audit interne: Vérifier calculs
- Gestion stock: Connaître consommation réelle
- Contrôle de gestion: Analyser rotation produit
- Suivi matière: Justifier variations
- FIFO/LIFO: Évaluation précise inventaire

Norme d'utilisation:
- C'est le document standard d'audit comptable
- Chaque produit = une fiche
- À conserver à titre de preuve
- Required pour audit externe
- Sert à réconciliation stock/bilan

Périodes standard:
- Mensuelle: suivi opérationnel
- Trimestrielle: reporting management
- Annuelle: audit/bilan comptable

Résultat attendu:
- Stock initial + Entrées - Sorties = Stock final (DOIT égal physique)
- Si discordance → investigation requise

Erreurs possibles:
- 401: Non authentifié
- 403: Pas d'accès aux données de cet utilisateur
- 404: Produit non trouvé pour cet utilisateur`,
  })
  @ApiParam({
    name: 'userId',
    description:
      "ID unique (MongoDB ObjectId) de l'utilisateur propriétaire/détenteur",
  })
  @ApiParam({
    name: 'productId',
    description: 'ID unique du produit',
  })
  @ApiResponse({
    status: 200,
    description:
      'Fiche de stock détaillée avec tous les mouvements et statistiques',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit ou utilisateur non trouvé',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getStockCard(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
  ) {
    if (!userId || !productId) {
      throw new BadRequestException('userId and productId are required');
    }
    return this.ledgerDisplayService.getStockCard(userId, productId);
  }

  /**
   * Affiche les mouvements d'actifs pour un utilisateur
   */
  @Get('actifs/:userId')
  @Auth()
  @ApiOperation({
    summary: "Mouvements d'ACTIFS d'un utilisateur",
    description: `Affiche UNIQUEMENT les mouvements d'ACTIFS de l'utilisateur: tous les produits qu'il possède ou détient.

Definition ACTIF:
- Ressources positives
- Éléments de valeur que l'utilisateur possède
- Biens à l'actif du bilan
- Ce qui ENTRE ou ce qu'il DÉTIENT

Contenu:
- Chaque mouvement d'actif inclut:
  - Produit: ID, nom, description, référence
  - Quantité: unités en stock
  - Valeur unitaire et totale
  - Type de mouvement: DÉPÔT, INITIALISATION, TRANSFERT (entrant), VIREMENT (entrant)
  - Date du mouvement
  - Source/Initiateur
  - Statut: VALIDÉ, PENDING, FLAGGED, REJETÉ

- Organisation:
  - Groupé par produit
  - Ou par type de mouvement
  - Ou par date (récent d'abord)

- Statistiques actifs:
  - Total produits: combien de références
  - Valeur brute: somme tous prix
  - Quantité totale: somme unités
  - Produit principal (concentration risque)

Utilisation:
- Bilan comptable: colonne ACTIF
- Garanties crédit: quelles collaterals
- Reporting personnel: "j'ai quoi?"
- Décision vente: évaluer portefeuille
- Suivi investissement: évolution actifs
- Assurance: inventaire couverture

Comparaison avec PASSIFS:
- Si Actifs > Passifs = situation saine
- Si Actifs < Passifs = risque d'insolvabilité
- Ratio Actifs/Passifs = pouvoir de crédit

Note: Retourne les actifs actuels avec pagination et recherche. Incluent les actifs créés par Stock Movement (ex: /depot) et Transactions.

Erreurs possibles:
- 401: Non authentifié
- 404: Utilisateur non trouvé ou pas d'actifs`,
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'actifs par page (défaut: 10)",
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par productId ou depotId',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @ApiResponse({
    status: 200,
    description:
      "Mouvements d'actifs: tous les produits possédés par l'utilisateur avec pagination",
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description: "Utilisateur non trouvé ou pas d'actifs",
  })
  async getActifs(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ): Promise<PaginationResult<any>> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const result = await this.ledgerDisplayService.getActifsWithPagination(
      userId,
      pageNum,
      limitNum,
      search,
    );

    return {
      status: 'success',
      message: `Actifs pour l'utilisateur ${userId} (page ${result.page}/${result.totalPages})`,
      data: result.data,
    } as any;
  }

  /**
   * Affiche les mouvements de passifs pour un utilisateur
   */
  @Get('passifs/:userId')
  @Auth()
  @ApiOperation({
    summary: "Mouvements de PASSIFS d'un utilisateur",
    description: `Affiche UNIQUEMENT les mouvements de PASSIFS de l'utilisateur: toutes les dettes/obligations à rembourser.

Definition PASSIF:
- Ressources négatives
- Obligations de l'utilisateur
- Dettes à rembourser
- Éléments de responsabilité au bilan
- Ce qu'il DOIT rendre/payer

Contenu:
- Chaque mouvement de passif inclut:
  - Produit dû: ID, nom, description, référence
  - Quantité due: unités à rembourser
  - Créancier: qui doit recevoir (propriétaire original)
  - Détenteur actuel: qui doit rendre
  - Type: DÉPÔT reçu (crée un passif), RETOUR (réduit), INITIALISATION de passif
  - Valeur: quantité × prix unitaire
  - Date création: quand la dette a commencé
  - Date échéance: quand rembourser
  - Status: actif (impayé), partiellement payé, clôturé

- Organisation:
  - Groupé par créancier (qui réclame)
  - Ou par produit
  - Ou par date d'échéance (les plus urgentes d'abord)

- Statistiques passifs:
  - Montant total dû (en €)
  - Quantité totale à rembourser
  - Créanciers (combien de personnes créancières)
  - Passif par créancier (dette max)
  - Passif moyen
  - Risque de défaut (évaluation)

Utilisation:
- Bilan comptable: colonne PASSIF
- Trésorerie: prévisionnel remboursements
- Reporting crédit: risque défaut
- Gestion fournisseurs: obligations
- Négociation délai: quand payer
- Suivi contentieux: dettes contestées
- Audit interne: obligation complètes

Comparaison avec ACTIFS:
- Si Passifs > Actifs = ALERTE: insolvabilité
- Si Passifs < Actifs = situation équilibrée
- Ratio Passifs/Actifs = levier financier

Types de passifs:
1. "Dépôt reçu": Quelqu'un m'a confié de la marchandise (je dois rendre)
2. "Emprunt": J'ai emprunté de la marchandise (je dois rembourser)
3. "Achat crédit": J'ai acheté à crédit (je dois payer)
4. "Passif créé": Transfert de propriété sans mouvement (dette crée)

Risque de crédit:
- Évalué par ratio Passifs/Actifs
- Si ratio > 1 = situation critique
- Si ratio > 0.5 = vigilance recommandée

Note: C'est une vue simplifiée de getUserLedger() mais avec UNIQUEMENT les passifs (sans actifs).

Erreurs possibles:
- 401: Non authentifié
- 404: Utilisateur non trouvé ou pas de passifs`,
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de passifs par page (défaut: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par productId ou depotId',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @ApiResponse({
    status: 200,
    description:
      "Mouvements de passifs: toutes les dettes de l'utilisateur (page 1/1)",
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé ou pas de passifs',
  })
  async getPassifs(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ): Promise<PaginationResult<any>> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const result = await this.ledgerDisplayService.getPassifsWithPagination(
      userId,
      pageNum,
      limitNum,
      search,
    );

    return {
      status: 'success',
      message: `Passifs pour l'utilisateur ${userId} (page ${result.page}/${result.totalPages})`,
      data: result.data,
    } as any;
  }
}
