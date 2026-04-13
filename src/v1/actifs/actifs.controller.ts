import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ActifsService } from './actifs.service';
import { Auth } from '../auth';

@ApiTags('Actifs')
@Controller()
export class ActifsController {
  constructor(private readonly actifsService: ActifsService) {}

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
    summary: 'Récupère tous les actifs d\'un site pour un select2',
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
}
