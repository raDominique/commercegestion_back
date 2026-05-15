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
  ApproveTransactionDto,
  RejectTransactionDto,
} from './dto/create-transaction.dto';
import { Auth } from '../auth';
import { TransactionStatus } from './transactions.schema';
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
1. Initiateur crée la demande (statut PENDING)
2. Un email est envoyé au destinataire pour notification
3. Destinataire reçoit une notification "nouvelle transaction"
4. Admin/Manager approuve ou rejette
5. Si approuvé: mouvements appliqués automatiquement
   - Actif initiateur: -quantité
   - Actif destinataire: +quantité
   - Passif créé: destinataire doit la marchandise à l'initiateur
6. Un email de confirmation est envoyé au destinataire

Champs requis:
- siteOrigineId: Site de départ
- siteDestinationId: Site d'arrivée
- productId: ID du produit
- quantite: Quantité
- detentaire: ID du détentaire
- ayant_droit: ID de l'ayant-droit
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
   * Approuve une transaction
   */
  @Patch(':id/approve')
  @Auth()
  @ApiOperation({
    summary: 'Approuver une transaction',
    description: `Approuve une transaction en attente et applique automatiquement les mouvements de stock.

Flux métier:
1. Admin/Manager approuve la transaction (statut change à APPROVED)
2. Les mouvements d'actif/passif sont appliqués:
   - Transaction DÉPÔT: initiateur perd quantité, destinataire gagne, passif créé
   - Transaction RETOUR: détenteur perd quantité, propriétaire regagne, passif réduit
   - Transaction INITIALISATION: stock créé avec mouvement INIT validé
3. Email de confirmation envoyé à l'initiateur (ou destinataire pour dépôt)
4. Approver name enregistré pour traçabilité

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
  ) {
    return this.transactionsService.getUserTransactions(
      userId,
      page,
      limit,
      status,
    );
  }

  /**
   * Exporte les transactions d'un utilisateur en CSV
   */
  @Get('user/:userId/export')
  @Auth()
  @ApiOperation({
    summary: "Exporter l'historique des transactions d'un utilisateur en CSV",
    description: "Génère un fichier CSV contenant toutes les transactions d'un utilisateur spécifique.",
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'URL du fichier CSV généré',
  })
  async exportUserTransactions(@Param('userId') userId: string) {
    if (!userId || userId.length !== 24) {
      throw new BadRequestException('Un ID utilisateur valide est requis');
    }
    const fileUrl = await this.transactionsService.exportUserTransactions(userId);
    return { status: 'success', file: fileUrl };
  }

  /**
   * Exporte toutes les transactions du système en CSV
   */
  @Get('export/all')
  @Auth()
  @ApiOperation({
    summary: 'Exporter toutes les transactions du système en CSV',
    description: 'Génère un fichier CSV contenant toutes les transactions enregistrées dans le système.',
  })
  @ApiResponse({
    status: 200,
    description: 'URL du fichier CSV généré',
  })
  async exportAllTransactions() {
    const fileUrl = await this.transactionsService.exportAllTransactions();
    return { status: 'success', file: fileUrl };
  }
}
