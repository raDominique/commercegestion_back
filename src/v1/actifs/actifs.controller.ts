import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ActifsService } from './actifs.service';
import { Auth } from '../auth';

@ApiTags('Actifs')
@Controller()
export class ActifsController {
  constructor(private readonly actifsService: ActifsService) {}

  @Get('get-by-ids')
  @Auth()
  @ApiOperation({
    summary: 'Détails de plusieurs actifs par IDs',
    description: `Récupère les détails de plusieurs actifs en une seule requête.

Utilisation: /get-by-ids?ids=id1,id2,id3

Utile pour afficher le détail des actifs regroupés dans la vue liste (productId + depotId).

Comportement:
- Si l'ID correspond à un actif (ACTIF), sa structure d'actif est retournée.
- Si l'ID correspond à une transaction (ex: DÉPÔT PENDING qui apparaît dans la liste),
  la transaction complète est retournée dans sa structure native
  (transactionNumber, type, status, initiatorId, recipientId,
  siteOrigineId, siteDestinationId, etc.) pour un affichage dédié.

La réponse est une liste mixte: actifs et transactions.`,
  })
  @ApiQuery({
    name: 'ids',
    required: true,
    description:
      'IDs MongoDB des actifs ou des transactions, séparés par des virgules',
    example: '6a59c0fe9520706d1f14f1c2,6a59c1a49520706d1f14f25d',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des actifs et/ou transactions trouvés',
  })
  @ApiResponse({ status: 400, description: 'Paramètre ids manquant' })
  async findByIds(@Query('ids') ids: string) {
    if (!ids?.trim()) {
      throw new BadRequestException('Le paramètre ids est requis');
    }
    const idList = ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.actifsService.getActifsByIds(idList);
  }

  @Get('get-by-id/:id')
  @Auth()
  @ApiOperation({
    summary: "Détails complets d'un actif",
    description: `Récupère les informations détaillées d\'un actif spécifique (produit possédé/détenu).

Définition ACTIF:
- Ressource positive au bilan
- Bien ou produit que l\'utilisateur possède
- Quantité > 0 en stock
- À l\'actif du bilan comptable

Contenu retourné:
- Produit: ID, nom complet, référence, description
- Propriétaire: Qui en est le propriétaire légal
- Détenteur actuel: Qui le détient physiquement
- Quantité actuelle en stock
- Valeur unitaire (prix)
- Valeur totale = quantité × prix
- Date d\'acquisition/initialisation
- Site de stockage
- Numéro de lot/batch (si applicable)
- Status: Actif, suspendu, en vérification

Cas d\'usage:
- Consultation personnelle: "Qu\'ai-je en stock?"
- Détails produit pour inventaire
- Justification comptable: Fiche d\'actif
- Avant transfert: Vérifier propriété/quantité
- Audit: Réconciliation stock ↔ système
- Blocage/Déverrouillage: Avant saisi

Différence avec shop-available:
- **get-by-id**: Vue détaillée (1 actif)
- **shop-available**: Vue catalogue (tous les produits en vente)

Erreurs possibles:
- 401: Non authentifié
- 403: Pas d\'accès à cet actif (n\'appartient pas à l\'utilisateur)
- 404: Actif non trouvé`,
  })
  @ApiResponse({
    status: 200,
    description: "Détails complets de l'actif avec propriétaire et statut",
    schema: {
      example: {
        _id: '507f1f77bcf86cd799439050',
        productId: '507f1f77bcf86cd799439030',
        productName: 'Ciment Portland 42,5',
        codeCPC: 'MAT-001',
        quantity: 500,
        prixUnitaire: 50,
        prixTotal: 25000,
        ownerId: '507f1f77bcf86cd799439001',
        ownerName: 'Alice Dupont',
        holderId: '507f1f77bcf86cd799439002',
        holderName: 'Bob Martin',
        siteId: '507f1f77bcf86cd799439100',
        siteName: 'Dépôt A',
        acquiredAt: '2026-04-01T10:30:45.000Z',
        status: 'ACTIF',
        batch: 'LOT-2026-001',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: "Pas d'accès à cet actif" })
  @ApiResponse({ status: 404, description: 'Actif non trouvé' })
  findOne(@Param('id') id: string) {
    return this.actifsService.getActifDetails(id);
  }

  @Get('shop-available')
  @Auth()
  @ApiOperation({
    summary: 'Catalogue de produits disponibles à la vente',
    description: `Récupère le catalogue de TOUS les produits actuellement disponibles à la vente: les ACTIFS validés avec quantité > 0.

Critères de sélection:
- Validé par un admin (status = VALIDÉ)
- Quantité en stock > 0 (disponible)
- Propriétaire autorisé à vendre
- Non suspendu/bloqué
- Non en litige

Contenu du catalogue:
- Pour chaque produit en vente:
  - ID, nom, référence (code CPC)
  - Description courte
  - Prix unitaire
  - Quantité disponible
  - Fournisseur/Ayant-droit (vendeur)
  - Image/illustration (si disponible)
  - Catégorie/Classification
  - Notation/Avis (si applicable)

Utilisation:
- Frontend: Afficher la boutique
- Panier: Sélectionner les produits
- Stock: Vérifier disponibilité
- Recherche: Trouver produits par nom/code
- Tri: Par prix, date, popularité

Filtrage disponible:
- **search**: Nom ou code CPC (recherche textuelle)
- **fournisseurId**: Filtrer par vendeur spécifique
- **sort**: Champ de tri (createdAt, productName, codeCPC, prixUnitaire)
- **order**: 1=Croissant, -1=Décroissant

Pagination:
- **page**: Numéro de page (défaut: 1)
- **limit**: Produits par page (défaut: 10)

Exemple flux:
1. Frontend appelle /shop-available?page=1&limit=20
2. Reçoit 20 produits + count total
3. Affiche catalogue filtré
4. Utilisateur clique → /get-by-id/:id pour détails
5. Ajoute au panier → transaction

Note: C\'est la VUE PUBLIQUE du catalogue. Les passifs/dettes ne sont pas visibles ici.

Erreurs possibles:
- 400: Paramètres requête invalides (page/limit non numérique)
- 401: Non authentifié`,
  })
  @ApiResponse({
    status: 200,
    description: 'Catalogue paginé des produits en vente',
    schema: {
      example: {
        data: [
          {
            _id: '507f1f77bcf86cd799439050',
            productId: '507f1f77bcf86cd799439030',
            productName: 'Ciment Portland 42,5',
            codeCPC: 'MAT-001',
            description: 'Ciment haute performance pour béton structurel',
            quantity: 500,
            prixUnitaire: 50,
            fournisseurId: '507f1f77bcf86cd799439001',
            fournisseurName: 'Alice Dupont',
            category: 'Matériaux',
            status: 'VALIDÉ',
            createdAt: '2026-04-01T10:30:45.000Z',
          },
          {
            _id: '507f1f77bcf86cd799439051',
            productId: '507f1f77bcf86cd799439031',
            productName: 'Gravier 0-20 mm',
            codeCPC: 'MAT-002',
            description: 'Gravier naturel concassé pour béton',
            quantity: 1000,
            prixUnitaire: 25,
            fournisseurId: '507f1f77bcf86cd799439001',
            fournisseurName: 'Alice Dupont',
            category: 'Matériaux',
            status: 'VALIDÉ',
            createdAt: '2026-04-01T11:45:30.000Z',
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
  @ApiResponse({ status: 400, description: 'Paramètres requête invalides.' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de la page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de produits par page (défaut: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par nom ou code CPC',
  })
  @ApiQuery({
    name: 'fournisseurId',
    required: false,
    type: String,
    description: 'Filtrer par ID du vendeur (Ayant-droit)',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'Champ pour le tri',
    example: 'prixUnitaire',
    enum: ['createdAt', 'productName', 'codeCPC', 'prixUnitaire'],
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: Number,
    description: 'Ordre: 1 (Asc), -1 (Desc)',
    example: -1,
  })
  async getShopProducts(@Query() query: any) {
    return this.actifsService.getAvailableValidatedProducts(query);
  }

  @Get('all-by-site/:siteId')
  @Auth()
  @ApiOperation({
    summary: "Récupère tous les actifs d'un site pour un select2",
    description: `Récupère tous les actifs disponibles sur un site sans pagination.
    
Retourne:
- quantité: Quantité disponible
- productId: ID du produit
- productName: Nom du produit

Utilisation: Remplir des listes déroulantes (select2)

Conditions:
- Site valide
- Actifs actifs (isActive = true)
- Quantité > 0`,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste de tous les actifs du site',
    schema: {
      example: [
        {
          quantite: 500,
          productId: '507f1f77bcf86cd799439030',
          productName: 'Ciment Portland 42,5',
        },
        {
          quantite: 1000,
          productId: '507f1f77bcf86cd799439031',
          productName: 'Gravier 0-20 mm',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Site non trouvé' })
  async getAllActifsByIdSite(@Param('siteId') siteId: string) {
    return this.actifsService.getAllActifsByIdSite(siteId);
  }

  @Get('my-deposits')
  @Auth()
  @ApiOperation({
    summary:
      "Liste des actifs déposés par l'utilisateur connecté chez un détenteur/fournisseur",
    description: `Récupère les actifs où l'utilisateur connecté est le **ayant-droit** (propriétaire légal)
et qui sont détenus physiquement par un **détenteur fournisseur** (detentaire).

Critères de sélection:
- L'utilisateur connecté est l'ayant-droit (propriétaire qui a déposé)
- Le détenteur (detentaire) est un fournisseur/provider externe
- Actifs actifs (isActive = true)
- Quantité > 0

Filtrage:
- **detenteurId** (optionnel): Si fourni, ne liste que les actifs déposés chez ce détenteur/fournisseur spécifique.
  Sinon, liste tous les actifs déposés chez des détenteurs externes.
- **siteId** (optionnel): Si fourni, ne liste que les actifs déposés sur ce site de dépôt spécifique.
- **search** (optionnel): Recherche par nom de produit ou code CPC
- **page**: Numéro de page (défaut: 1)
- **limit**: Nombre d'actifs par page (défaut: 10)

Contenu retourné:
- Pour chaque actif: produit, détenteur (fournisseur), site de dépôt, quantité, prix unitaire
- Pagination complète (total, page, limit)

Cas d'usage:
- "Qu'ai-je déposé chez tel fournisseur?"
- Suivi de mes actifs déposés chez des tiers
- Vérification des stocks externalisés
- Audit des dépôts fournisseurs

Erreurs possibles:
- 401: Non authentifié`,
  })
  @ApiQuery({
    name: 'detenteurId',
    required: false,
    type: String,
    description: 'ID du détenteur/fournisseur pour filtrer les actifs déposés',
    example: '6a59c0fe9520706d1f14f1c2',
  })
  @ApiQuery({
    name: 'siteId',
    required: false,
    type: String,
    description: 'ID du site de dépôt pour filtrer les actifs déposés sur ce site',
    example: '6a59c1a49520706d1f14f25d',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de la page (défaut: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: "Nombre d'actifs par page (défaut: 10)",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par nom de produit ou code CPC',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des actifs déposés',
    schema: {
      example: {
        status: 'success',
        message: "Actifs déposés par l'utilisateur connecté chez le détenteur",
        data: [
          {
            _id: '507f1f77bcf86cd799439050',
            productId: {
              _id: '507f1f77bcf86cd799439030',
              productName: 'Ciment Portland 42,5',
              codeCPC: 'MAT-001',
              prixUnitaire: 50,
            },
            detentaire: {
              _id: '507f1f77bcf86cd799439002',
              userName: 'Hangar Dupont',
              userNickName: 'hangar-dupont',
              raisonSocial: null,
            },
            depotId: {
              siteName: 'Hangar Dupont',
              siteAddress: '123 Rue du Commerce',
            },
            quantite: 500,
            prixUnitaire: 50,
            createdAt: '2026-06-15T10:30:45.000Z',
            updatedAt: '2026-06-15T10:30:45.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getMyDeposits(
    @Req() req: Request & { user: { userId: string } },
    @Query('detenteurId') detenteurId?: string,
    @Query('siteId') siteId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.actifsService.getDepositedActifsByDetenteur(req.user.userId, {
      detenteurId,
      siteId,
      page,
      limit,
      search,
    });
  }

  @Get('export')
  @Auth()
  @ApiOperation({ summary: 'Exporter les données en Excel ou PDF' })
  @ApiQuery({
    name: 'format',
    required: true,
    enum: ['excel', 'pdf'],
    description: "Format d'export: excel ou pdf",
  })
  @ApiResponse({ status: 200, description: 'URL du fichier généré' })
  async exportAll(
    @Query('format') format: 'excel' | 'pdf',
    @Req() req: any,
  ): Promise<StreamableFile> {
    if (!format || !['excel', 'pdf'].includes(format)) {
      throw new BadRequestException(
        'Format invalide. Utilisez "excel" ou "pdf".',
      );
    }
    const userId = req.user?.userId || 'system';
    const result = await this.actifsService.exportAll(format, userId);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
