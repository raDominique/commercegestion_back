import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateDepositDto,
  CreateReturnDto,
  CreateInitializationDto,
  CreateVenteDto,
  CreateVirementDroitDto,
  ApproveTransactionDto,
  RejectTransactionDto,
} from './dto/create-transaction.dto';
import { Auth } from '../auth';
import { TransactionStatus, TransactionType } from './transactions.schema';
import { Request } from 'express';

@ApiTags('Transactions')
@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Crée une nouvelle transaction de dépôt
   */
  @Post('deposit')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une transaction de dépôt',
    description: `Crée une demande de dépôt d'actif vers un autre membre (phase 1: création en attente).
    
Flux métier:
1. Initiateur (ayant_droit) crée la demande (statut PENDING)
2. La quantité est mise en **attente** (quantiteEnAttente) — pas de déduction du stock réel
3. Un email est envoyé au détenteur (destinataire) pour notification
4. Admin/Manager approuve ou rejette
5. Si approuvé:
   - Réservation confirmée: le stock réel du déposant diminue
   - Actif du **déposant**: quantité ajoutée sur son bilan, détenue physiquement par le détenteur
   - Actif du **détenteur**: quantité ajoutée sur son bilan, appartient légalement au déposant
   - Passif du **détenteur**: il doit la marchandise au déposant (débiteur = détenteur, créancier = ayant_droit)
6. Si rejeté: la réservation est libérée (stock disponible restauré)
7. Un email de confirmation est envoyé

Schéma comptable (dépôt de 10 Riz chez Superadmin):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Déposant (ayant_droit) :
  Actif:  10 Riz détenus par Superadmin    ✅
  Passif: aucun                             ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Superadmin (détenteur) :
  Actif:  10 Riz appartenant au déposant   ✅
  Passif: 10 Riz dus au déposant            ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Champs requis:
- siteOrigineId: Site de départ (où est le stock actuellement)
- siteDestinationId: Site d'arrivée (où sera stocké physiquement)
- productId: ID du produit
- quantite: Quantité
- detentaire: ID du membre qui gardera physiquement (destinataire)
- ayant_droit: ID du membre propriétaire légal (initiateur)
- prixUnitaire: (optionnel) Prix unitaire
- observations: (optionnel) Observations

Erreurs possibles:
- 400: Données invalides
- 401: Non authentifié`,
  })
  @ApiResponse({
    status: 201,
    description:
      'Transaction de dépôt créée avec succès. Numéro unique (ULID) généré. Email envoyé au destinataire.',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        type: 'DÉPÔT',
        status: 'PENDING',
        initiatorId: '507f1f77bcf86cd799439001',
        recipientId: '507f1f77bcf86cd799439002',
        productId: '507f1f77bcf86cd799439003',
        siteOrigineId: '507f1f77bcf86cd799439004',
        siteDestinationId: '507f1f77bcf86cd799439005',
        quantite: 100,
        prixUnitaire: 50,
        detentaire: '507f1f77bcf86cd799439002',
        ayant_droit: '507f1f77bcf86cd799439001',
        observations: 'Dépôt commercial',
        createdAt: '2026-04-01T10:30:45.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Paramètres invalides ou champs manquants',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiBody({ type: CreateDepositDto })
  async createDeposit(@Body() createDepositDto: CreateDepositDto) {
    return this.transactionsService.createDeposit(createDepositDto);
  }

  /**
   * Crée une nouvelle transaction de retour
   */
  @Post('return')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer une transaction de retour',
    description: `Crée une demande de retour d'actif au propriétaire original.
    
Flux métier:
1. Détenteur crée une demande de retour (statut PENDING)
2. Email envoyé au propriétaire pour notification
3. Admin/Manager approuve ou rejette
4. Si approuvé: mouvements appliqués automatiquement
   - Actif détenteur: -quantité
   - Actif propriétaire: +quantité
   - Passif réduit ou supprimé (propriétaire devait la marchandise au détenteur)
5. Email de confirmation envoyé au propriétaire

Utilisation:
- Annuler un dépôt
- Retourner au propriétaire
- Restaurer le stock original

Erreurs possibles:
- 400: Données invalides
- 401: Non authentifié`,
  })
  @ApiResponse({
    status: 201,
    description:
      'Transaction de retour créée avec succès. Numéro unique (ULID) généré. Email envoyé au propriétaire.',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439012',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
        type: 'RETOUR',
        status: 'PENDING',
        initiatorId: '507f1f77bcf86cd799439002',
        recipientId: '507f1f77bcf86cd799439001',
        productId: '507f1f77bcf86cd799439003',
        siteOrigineId: '507f1f77bcf86cd799439004',
        siteDestinationId: '507f1f77bcf86cd799439005',
        quantite: 100,
        prixUnitaire: 50,
        detentaire: '507f1f77bcf86cd799439002',
        ayant_droit: '507f1f77bcf86cd799439001',
        observations: 'Retour sans dommages',
        createdAt: '2026-04-01T11:30:45.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Paramètres invalides ou champs manquants',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiBody({ type: CreateReturnDto })
  async createReturn(@Body() createReturnDto: CreateReturnDto) {
    return this.transactionsService.createReturn(createReturnDto);
  }

  /**
   * Crée une transaction d'initialisation de stock
   */
  @Post('initialization')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initialiser le stock pour un nouvel actif/passif',
    description: `Crée une transaction d'initialisation pour créer un nouvel actif ou passif en stock.
    
Flux métier:
1. Propriétaire crée une initialisation (statut PENDING)
2. Email envoyé au créateur pour confirmation
3. Admin/Manager approuve ou rejette
4. Si approuvé: nouveau mouvement créé
   - Crée une ligne actif avec mouvement INIT (initialisation)
   - Définit le stock initial
   - Marque le mouvement comme validé
5. Email de confirmation envoyé

Utilisation:
- Créer un nouvel actif (ex: nouveau lot de produits)
- Ajouter un nouveau passif (ex: nouvel emprunt)
- Initialiser le stock pour un nouveau code produit

Champs requis:
- productId: ID du produit
- quantite: Quantité à initialiser (strictement positive)
- siteOrigineId: Site d'initialisation
- prixUnitaire: (optionnel) Prix unitaire
- observations: (optionnel) Observations

Erreurs possibles:
- 400: Quantité invalide ou champs manquants
- 401: Non authentifié`,
  })
  @ApiResponse({
    status: 201,
    description:
      'Initialisation créée avec succès. Mouvement enregistré. Email envoyé.',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439012',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
        type: 'INITIALISATION',
        status: 'PENDING',
        initiatorId: '507f1f77bcf86cd799439002',
        productId: '507f1f77bcf86cd799439001',
        siteOrigineId: '507f1f77bcf86cd799439004',
        siteDestinationId: '507f1f77bcf86cd799439004',
        quantite: 500,
        prixUnitaire: 100,
        detentaire: '507f1f77bcf86cd799439002',
        ayant_droit: '507f1f77bcf86cd799439002',
        observations: 'Stock initial',
        createdAt: '2026-04-01T10:15:30.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Paramètres invalides ou quantité négative',
  })
  @ApiBody({ type: CreateInitializationDto })
  async createInitialization(
    @Req() req: Request & { user: { userId: string } },
    @Body() createInitDto: CreateInitializationDto,
  ) {
    return this.transactionsService.createInitialization(
      createInitDto,
      req.user.userId,
    );
  }

  /**
   * Virement de droit auprès d’un bénéficiaire tiers
   * Transfère le droit de propriété (ayant_droit) d'un dépôt chez un détenteur Y,
   * depuis le membre X (initiateur/propriétaire) vers Z (bénéficiaire), sans mouvement physique.
   */
  @Post('virement-droit')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Virement de droit (X -> Z) sur un dépôt chez Y',
  })
  @ApiBody({ type: CreateVirementDroitDto })
  async createVirementDroit(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateVirementDroitDto,
  ) {
    return this.transactionsService.createVirementDroit(dto, req.user.userId);
  }

  /**
   * Crée une transaction d'achat/vente
   */
  @Post('vente')
  @Auth()
  @ApiOperation({
    summary: 'Acheter/Échanger un actif (Créer une transaction VENTE)',
    description: `Un membre achète ou échange un actif avec un autre membre.

La contrepartie peut être monétaire (pas de produit de contrepartie) ou un autre produit (échange).
Le rapport d'échange remplace le prix unitaire:
  - Vente monétaire : rapport d'échange = prix en FCFA par unité (ex: 500 FCFA/kg)
  - Échange produit : rapport d'échange = quantité de contrepartie par unité (ex: 2 kg de Maïs pour 1 kg de Riz)

L'acheteur initie la transaction. Les stocks sont réservés chez les deux parties en attente d'approbation.
Une fois approuvée, les actifs sont transférés.

Flux:
1. Acheteur soumet → statut PENDING, stock produit réservé chez le vendeur + stock contrepartie réservé chez l'acheteur
2. Vendeur approuve → actif produit vers acheteur + actif contrepartie vers vendeur
3. Vendeur rejette → stocks restaurés des deux côtés`,
  })
  @ApiResponse({
    status: 201,
    description: `Transaction de vente/échange créée avec succès.
- Stock du produit réservé chez le vendeur
- Stock de la contrepartie réservé chez l'acheteur (si échange produit)
- En attente d'approbation par le vendeur`,
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        type: 'VENTE',
        status: 'PENDING',
        initiatorId: '507f1f77bcf86cd799439001', // acheteur
        recipientId: '507f1f77bcf86cd799439002', // vendeur
        productId: '507f1f77bcf86cd799439003', // produit acheté
        contrepartieId: '507f1f77bcf86cd799439004', // null si vente monétaire
        rapportEchange: 500, // FCFA/unité ou ratio produit
        siteOrigineId: '507f1f77bcf86cd799439005', // site du vendeur
        siteDestinationId: '507f1f77bcf86cd799439006', // site de l'acheteur
        quantite: 100,
        prixUnitaire: 500, // null si échange produit
        detentaire: '507f1f77bcf86cd799439002', // vendeur
        ayant_droit: '507f1f77bcf86cd799439001', // acheteur
        observations: 'Achat de 100 kg de Riz',
        createdAt: '2026-04-01T10:30:45.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Paramètres invalides, champs manquants ou stock insuffisant',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiBody({ type: CreateVenteDto })
  async createVente(
    @Req() req: Request & { user: { userId: string } },
    @Body() createVenteDto: CreateVenteDto,
  ) {
    return this.transactionsService.createVente(
      createVenteDto,
      req.user.userId,
    );
  }

  /**
   * Approuve une transaction
   */
  @Patch(':id/approve')
  @Auth()
  @ApiOperation({
    summary: 'Approuver une transaction',
    description: `Approuve une transaction en attente et applique automatiquement les mouvements de stock.

Flux métier:
1. Admin/Manager approuve la transaction (statut change à APPROVED)
2. Confirmation des réservations:
   - Transaction DÉPÔT: confirmation de la mise en attente (quantiteEnAttente → stock réel)
3. Mouvements d'actif/passif appliqués:
   - Transaction DÉPÔT:
     * Actif du déposant: +quantité détenue par le détenteur
     * Actif du détenteur: +quantité appartenant au déposant
     * Passif du détenteur: doit la marchandise au déposant (débiteur = détenteur)
   - Transaction RETOUR: détenteur perd quantité, propriétaire regagne, passif réduit
   - Transaction INITIALISATION: stock créé avec mouvement INIT validé
4. Email de confirmation envoyé à l'initiateur (ou destinataire pour dépôt)
5. Approver name enregistré pour traçabilité

Champs:
- id (path): ID unique de la transaction
- approuveurId (body): ID de l'utilisateur qui approuve
- observations: (optionnel) Observations additionnelles

Erreurs possibles:
- 400: Statut invalide pour approbation
- 401: Non authentifié
- 404: Transaction non trouvée`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la transaction à approuver',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transaction approuvée avec succès. Mouvements appliqués. Email de confirmation envoyé.',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        type: 'DÉPÔT',
        status: 'APPROVED',
        approuveurId: '507f1f77bcf86cd799439005',
        approvedAt: '2026-04-01T14:30:45.000Z',
        quantite: 100,
        prixUnitaire: 50,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transaction non trouvée' })
  @ApiResponse({
    status: 400,
    description: 'Statut invalide (ne peut approuver que PENDING)',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiBody({ type: ApproveTransactionDto })
  async approveTransaction(
    @Param('id') id: string,
    @Body() approveDto: ApproveTransactionDto,
  ) {
    return this.transactionsService.approveTransaction(id, approveDto);
  }

  /**
   * Rejette une transaction
   */
  @Patch(':id/reject')
  @Auth()
  @ApiOperation({
    summary: 'Rejeter une transaction en attente',
    description: `Rejette une transaction PENDING et annule le processus.

Flux métier:
1. Admin/Manager rejette la transaction (statut change à REJECTED)
2. Aucun mouvement n'est appliqué (stock inchangé)
3. Email de notification envoyé à l'initiateur avec:
   - Motif du rejet (dans motifRejet)
   - Nom de l'approbateur/rejecteur
4. Permet de nettoyer les transactions invalides

Utilisation:
- Rejeter un dépôt si le produit n'existe pas
- Refuser un retour si les conditions ne sont pas respectées
- Annuler une initialisation si la quantité est incorrecte

Champs:
- id (path): ID unique de la transaction
- motifRejet (body): Raison du rejet (affichée au demandeur)
- approuveurId (body): ID de l'utilisateur qui rejette

Erreurs possibles:
- 400: Statut invalide pour rejet (ne peut rejeter que PENDING)
- 401: Non authentifié
- 404: Transaction non trouvée`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique de la transaction à rejeter',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transaction rejetée avec succès. Aucun mouvement appliqué. Email de notification envoyé.',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        type: 'DÉPÔT',
        status: 'REJECTED',
        motifRejet: 'Produit indisponible en ce moment',
        approuveurId: '507f1f77bcf86cd799439005',
        rejectedAt: '2026-04-01T15:20:30.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transaction non trouvée' })
  @ApiResponse({
    status: 400,
    description: 'Statut invalide (ne peut rejeter que PENDING)',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiBody({ type: RejectTransactionDto })
  async rejectTransaction(
    @Param('id') id: string,
    @Body() rejectDto: RejectTransactionDto,
  ) {
    return this.transactionsService.rejectTransaction(id, rejectDto);
  }

  /**
   * Récupère les dépôts de l'utilisateur chez d'autres membres
   * qui n'ont pas encore fait l'objet d'un virement de droit
   */
  @Get('deposit-at-others/me')
  @Auth()
  @ApiOperation({
    summary: 'Dépôts chez les autres membres sans virement de droit',
    description: `Récupère toutes les transactions DÉPÔT approuvées où l'utilisateur connecté est l'ayant-droit (propriétaire)
et le détenteur est un autre membre, et qui n'ont pas encore fait l'objet d'un virement de droit (VIREMENT_DROIT).

Utilité:
- Voir les marchandises déposées chez d'autres membres dont les droits n'ont pas été transférés
- Identifier les dépôts disponibles pour un virement de droit
- Gérer les actifs externes

Pagination:
- page: numéro de page (défaut: 1)
- limit: nombre par page (défaut: 10)`,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'éléments par page (défaut: 10)",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par nom de produit ou numéro de transaction',
  })
  @ApiQuery({
    name: 'siteId',
    required: false,
    type: String,
    description: "Filtrer par site (ID du site d'origine ou de destination)",
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    type: String,
    description: 'Filtrer par produit',
  })
  @ApiQuery({
    name: 'detentaireId',
    required: false,
    type: String,
    description: 'Filtrer par détenteur (membre qui garde physiquement)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des dépôts chez les autres membres',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getAllDepositAtOthersMe(
    @Req() req: Request & { user: { userId: string } },
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('siteId') siteId?: string,
    @Query('productId') productId?: string,
    @Query('detentaireId') detentaireId?: string,
  ) {
    return this.transactionsService.getAllDepositAtOthersMe(
      req.user.userId,
      page,
      limit,
      search,
      siteId,
      productId,
      detentaireId,
    );
  }

  /**
   * Récupère une transaction par ID
   */
  @Get(':id')
  @Auth()
  @ApiOperation({
    summary: "Détails complète d'une transaction",
    description: `Récupère les détails complets d'une transaction incluant tous les mouvements, les participants et l'historique.

Contenu retourné:
- Informations de base: ID, numéro ULID, type (DÉPÔT/RETOUR/INIT), statut
- Participants: initiatorId, recipientId avec données dénormalisées (noms, emails)
- Produit: productId avec nom, référence
- Quantité et prix unitaire
- Mouvements: Tous les mouvements appliqués à la transaction
- Horodatages: createdAt, approvedAt, rejectedAt
- Approbateur: approverId, approvedBy (nom et email si approuvé/rejeté)

Statuts possibles:
- PENDING: En attente d'approbation
- APPROVED: Approuvée et mouvements appliqués
- REJECTED: Rejetée, aucun mouvement appliqué

Erreurs possibles:
- 401: Non authentifié
- 404: Transaction non trouvée`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID unique (MongoDB ObjectId) de la transaction',
  })
  @ApiResponse({
    status: 200,
    description: 'Détails complets de la transaction',
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439011',
        transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        type: 'DÉPÔT',
        status: 'APPROVED',
        initiatorId: '507f1f77bcf86cd799439001',
        initiatorName: 'Alice Dupont',
        recipientId: '507f1f77bcf86cd799439002',
        recipientName: 'Bob Martin',
        productId: '507f1f77bcf86cd799439030',
        productName: 'Ciment Portland',
        quantity: 100,
        unitPrice: 50,
        movements: [
          {
            _id: '507f1f77bcf86cd799439050',
            type: 'MOUVEMENT',
            quantity: 100,
          },
        ],
        createdAt: '2026-04-01T10:30:45.000Z',
        approvedAt: '2026-04-01T14:30:45.000Z',
        approverName: 'Admin User',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Transaction non trouvée' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getTransactionById(@Param('id') id: string) {
    return this.transactionsService.getTransactionById(id);
  }

  /**
   * Récupère les transactions en attente pour l'utilisateur
   */
  @Get('pending/list')
  @Auth()
  @ApiOperation({
    summary: "Lister les transactions en attente d'approbation",
    description: `Récupère toutes les transactions en statut PENDING en attente de validation par l'utilisateur (Admin/Manager).

Contenu:
- Numéro ULID unique
- Type de transaction (DÉPÔT, RETOUR, INITIALISATION)
- Initiateur de la demande
- Destinataire (si applicable)
- Produit et quantité
- Date de création
- Statut toujours = PENDING

Paginatio:
- page: numéro de page (défaut: 1)
- limit: nombre par page (défaut: 10, max: 100)

Utilisation:
- Admin voit les transactions à valider
- Trier par date (les plus anciennes en premier)
- Permet de gérer le backlog de validation

Erreurs possibles:
- 400: userId manquant dans query
- 401: Non authentifié`,
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: "ID de l'utilisateur (Manager/Admin qui doit approuver)",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'éléments par page (défaut: 10)",
  })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des transactions en attente',
    schema: {
      example: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
            type: 'DÉPÔT',
            status: 'PENDING',
            initiatorName: 'Alice Dupont',
            productName: 'Ciment Portland',
            quantity: 100,
            createdAt: '2026-04-01T10:30:45.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 45,
          pages: 5,
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'userId requis en query' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getPendingTransactions(
    @Query('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    return this.transactionsService.getPendingTransactions(userId, page, limit);
  }

  /**
   * Récupère les transactions de l'utilisateur
   */
  @Get('user/:userId')
  @Auth()
  @ApiOperation({
    summary: "Historique complet des transactions d'un utilisateur",
    description: `Récupère toutes les transactions de l'utilisateur (initiées ou reçues) avec filtrage par statut et pagination.

Scope:
- Utilisateur voit TOUTES ses transactions
- Initiateur: transactions qu'il a créées
- Destinataire: transactions reçues de dépôt/retour
- Trace l'historique complet des mouvements

Statuts:
- PENDING: En attente d'approbation par Admin
- APPROVED: Approuvée, mouvements appliqués, confirmée
- REJECTED: Rejetée, aucun mouvement appliqué

Pagination:
- page: numéro de page (défaut: 1)
- limit: nombre par page (défaut: 10, max: 100)

Filtrage:
- status (optional): PENDING, APPROVED, ou REJECTED
- Sans status: retourne toutes les transactions

Utilisation:
- Dashboard personnel
- Historique des mouvements
- Audit trail
- Suivi des transactions reçues

Tri: Par date décroissante (plus récentes en premier)

Erreurs possibles:
- 401: Non authentifié
- 404: Utilisateur non trouvé`,
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
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'éléments par page (défaut: 10)",
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filtrer par statut: PENDING, APPROVED, REJECTED (optionnel)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filtrer par type: DÉPÔT, RETRAIT, INITIALISATION (optionnel)',
  })
  @ApiResponse({
    status: 200,
    description: "Liste paginée de toutes les transactions de l'utilisateur",
    schema: {
      example: {
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
            type: 'DÉPÔT',
            status: 'APPROVED',
            initiatorName: 'Alice Dupont',
            recipientName: 'Bob Martin',
            productName: 'Ciment Portland',
            quantity: 100,
            createdAt: '2026-04-01T10:30:45.000Z',
            approvedAt: '2026-04-01T14:30:45.000Z',
          },
          {
            _id: '507f1f77bcf86cd799439012',
            transactionNumber: '01ARZ3NDEKTSV4RRFFQ69G5FBC',
            type: 'RETOUR',
            status: 'PENDING',
            initiatorName: 'Bob Martin',
            recipientName: 'Alice Dupont',
            productName: 'Ciment Portland',
            quantity: 50,
            createdAt: '2026-04-02T09:15:30.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 23,
          pages: 3,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async getUserTransactions(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: TransactionStatus,
    @Query('type') type?: TransactionType,
  ) {
    return this.transactionsService.getUserTransactions(
      userId,
      page,
      limit,
      status,
      type,
    );
  }

  /**
   * Exporte les transactions d'un utilisateur en CSV
   */
  @Get('user/:userId/export')
  @Auth()
  @ApiOperation({
    summary:
      "Exporter l'historique des transactions d'un utilisateur en CSV, Excel ou PDF",
    description:
      "Génère un fichier contenant toutes les transactions d'un utilisateur spécifique.",
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique de l'utilisateur",
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['csv', 'excel', 'pdf'],
    description: "Format d'export (défaut: csv)",
  })
  @ApiResponse({
    status: 200,
    description: 'URL du fichier généré',
  })
  async exportUserTransactions(
    @Param('userId') userId: string,
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<StreamableFile> {
    if (!userId || userId.length !== 24) {
      throw new BadRequestException('Un ID utilisateur valide est requis');
    }
    const result = await this.transactionsService.exportUserTransactions(
      userId,
      format,
    );
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  /**
   * Exporte toutes les transactions du système en CSV
   */
  @Get('export/all')
  @Auth()
  @ApiOperation({
    summary: 'Exporter toutes les transactions du système en CSV, Excel ou PDF',
    description:
      'Génère un fichier contenant toutes les transactions enregistrées dans le système.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['csv', 'excel', 'pdf'],
    description: "Format d'export (défaut: csv)",
  })
  @ApiResponse({
    status: 200,
    description: 'URL du fichier généré',
  })
  async exportAllTransactions(
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<StreamableFile> {
    const result = await this.transactionsService.exportAllTransactions(format);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
