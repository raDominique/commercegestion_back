import { Controller, Post, Body, Req, Get, Query, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Auth } from '../auth';
import { CreateMovementDto } from './dto/create-movement.dto';
import { MovementType } from './stock-movement.schema';
import { StockService } from './stock.service';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';

@ApiTags('Stocks & Mouvements')
@Controller()
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
  ) {}

  // ==========================================
  // ÉTAPES DE MOUVEMENTS (FLUX 0 À 12)
  // ==========================================

  @Post('depot')
  @Auth()
  @ApiOperation({
    summary: 'Dépôt initial de produit en stock (premier enregistrement)',
    description: `Enregistre un mouvement DEPOT: première mise en stock d'un produit sur un site.

Flux métier (Première Déposition):
1. Propriétaire/détenteur crée un dépôt initial
2. Sélectionne le produit et la quantité
3. Désigne le site de destination (Hangar, Entrepôt, etc.)
4. Valide les informations
5. Mouvement type DEPOT enregistré
6. Produit marqué automatiquement comme "EN STOCK" (isStocker = true)
7. Actif créé pour le propriétaire
8. Passif créé si dépôt chez un tiers (pas le propriétaire du site)

Utilisation:
- Première immatriculation d'un produit en stock
- Initialisation de l'inventaire
- Début du suivi de propriété
- Création des registres actifs/passifs

Champs requis:
- productId: ID du produit à stocker
- quantite: Quantité à stocker (minimum 1)
- prixUnitaire: Prix unitaire du produit
- siteDestinationId: Site de destination (Hangar, Entrepôt, etc.)
- detentaire: (optionnel) Qui détient physiquement le produit
- observations: (optionnel) Notes sur le dépôt

Champs optionnels:
- siteOrigineId: NULL pour dépôt initial (calculé automatiquement)

Impact système après dépôt:
- Produit.isStocker passe à TRUE
- Création d'un Actif (ce que j'ai)
- Création d'un Passif si tiers impliqué
- Mouvement enregistré pour traçabilité
- Notification des acteurs

Validations:
- Quantité > 0
- Produit existe
- Site destination existe
- Prix unitaire >= 0

Erreurs possibles:
- 400: Quantité invalid ou paramètres manquants
- 401: Non authentifié
- 404: Produit ou site non trouvé`,
  })
  async createDeposit(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.DEPOT,
    );
  }

  @Post('transfer')
  @Auth()
  @ApiOperation({
    summary: 'Transférer un produit à un autre détenteur',
    description: `Enregistre un mouvement TRANSFERT physique d'un produit vers un autre détenteur sur le même site ou entre sites.

Flux métier:
1. Détenteur crée le mouvement de transfert
2. Sélectionne la quantité à transférer
3. Désigne le nouveau détenteur
4. Choix du site de destination (même site ou différent)
5. Mouvement enregistré avec type TRANSFERT
6. Stock détenteur actuel: -quantité
7. Stock nouveau détenteur: +quantité
8. Passif mis à jour (si applicable)

Champs requis:
- productId: ID du produit à transférer
- quantity: Quantité (doit être disponible)
- destinationSiteId: Site de destination
- newHolderId: ID du nouveau détenteur
- notes: (optionnel) Description du transfert

Validations:
- Vérifier que la quantité est disponible
- Valider que le nouveau détenteur existe
- Vérifier l'accès au site de destination

Erreurs possibles:
- 400: Quantité insuffisante ou paramètres invalides
- 401: Non authentifié
- 404: Produit ou détenteur non trouvé`,
  })
  async transfer(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.TRANSFERT,
    );
  }

  @Post('virement')
  @Auth()
  @ApiOperation({
    summary: 'Virement de propriété (changement de propriétaire)',
    description: `Enregistre un mouvement VIREMENT: changement de propriétaire/ayant-droit SANS mouvement physique.

Flux métier:
1. Propriétaire actuel crée le virement
2. Sélectionne la quantité à transférer de propriété
3. Désigne le nouveau propriétaire
4. Mouvement type VIREMENT enregistré
5. Produit reste physiquement au même endroit (mouvement émotionnel virement)
6. Propriété/Ayant-droit change
7. Passif créé ou modifié (nouveau propriétaire devient créancier)

Utilisation:
- Vendre un produit (changement de propriétaire)
- Transférer la responsabilité (sans mouvement physique)
- Enregistrer un échange de propriété
- Gérer les dettes de marchandises

Champs requis:
- productId: ID du produit
- quantity: Quantité transférée
- newOwnerId: ID du nouveau propriétaire
- reason: Motif du virement (vente, échange, donation)
- notes: (optionnel) Détails supplémentaires

Validations:
- Vérifier propriété du produit
- Valider que le nouveau propriétaire existe
- Vérifier les permissions

Erreurs possibles:
- 400: Quantité invalide ou propriété insuffisante
- 401: Non authentifié
- 403: Pas propriétaire du produit
- 404: Produit ou propriétaire non trouvé`,
  })
  async virement(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.VIREMENT,
    );
  }

  // ==========================================
  // RÉCUPÉRATION DES ACTIFS (CE QUE JE POSSÈDE)
  // ==========================================

  @Get('site-actifs/:siteId')
  @Auth()
  @ApiOperation({
    summary: "Consulter l'inventaire des actifs d'un site",
    description: `Récupère la liste complète des actifs (produits) actuellement stockés sur un site spécifique pour l'utilisateur actuel.

Contenu retourné:
- Produit: ID, nom, référence, description
- Quantité actuelle en stock
- Valeur unitaire (prix)
- Valeur totale (quantité × prix)
- Détenteur actuel
- Propriétaire/Ayant-droit
- Dernière mise à jour

Cas d'usage:
- Consultation du stock d'un entrepôt
- Vérification des disponibilités avant dépôt/retrait
- Inventaire physique
- Suivi des mouvements par site
- Rapport de stock

Note: Retourne UNIQUEMENT les actifs que l'utilisateur possède ou détient sur ce site. Les autres utilisateurs voient leur propre stock.

Erreurs possibles:
- 401: Non authentifié
- 403: Pas d'accès à ce site
- 404: Site non trouvé`,
  })
  async getSiteActifs(@Req() req: any, @Param('siteId') siteId: string) {
    return this.stockService.getSiteActifs(req.user.userId, siteId);
  }

  // ==========================================
  // RÉCUPÉRATION DES PASSIFS (CE QUE JE DOIS)
  // ==========================================

  @Get('site-passifs/:siteId')
  @Auth()
  @ApiOperation({
    summary: "Consulter les dettes (passifs) d'un site",
    description: `Récupère la liste de toutes les dettes/passifs (marchandises dues) associées à un site spécifique.

Contenu:
- Produit dechu: ID, nom, quantité due
- Propriétaire original (créancier): qui doit recevoir la marchandise
- Détenteur actuel: qui la détient (doit la rendre)
- Quantité due
- Date de création du passif
- Provenance: transaction de dépôt associée
- Status: actif, partiellement remboursé, soldé

Interprétation:
- Si je dois "10 unités de Ciment", cela signifie:
  - Quelqu'un m'a fait confiance et m'a confié 10 unités
  - Je dois les lui rendre (ou payer équivalent)
  - C'est une obligation/dette

Risk Management:
- Avant changement de détenteur: vérifier les passifs
- Avant rejet: s'assurer passifs rembourés
- Avant transfert: confirmer que les biens ne sont pas grevés

Erreurs possibles:
- 401: Non authentifié
- 403: Pas d'accès à ce site
- 404: Site non trouvé`,
  })
  async getSitePassifs(@Req() req: any, @Param('siteId') siteId: string) {
    return this.stockService.getSitePassifs(req.user.userId, siteId);
  }

  // ==========================================
  // JOURNAL DES MOUVEMENTS
  // ==========================================

  @Get('deposits')
  @Auth()
  @ApiOperation({
    summary: 'Journal des entrées en stock (dépôts)',
    description: `Récupère l'historique complet de tous les dépôts (entrées) de stock pour l'utilisateur avec pagination.

Contenu:
- Type: DÉPÔT ou INITIALISATION
- Produit: ID, nom, quantité
- Source: Qui a fait le dépôt (initiateur)
- Destinataire: Qui a reçu
- Site de destination
- Quantité entrante
- Date du mouvement
- Validateur (qui a validé le mouvement)
- Notes/commentaires

Utilisation:
- Audit: tracer toutes les entrées
- Réconciliation: vérifier conformité stock/registre
- Inventaire: historique des mouvements
- Retraçabilité: qui a apporté quoi et quand
- Détection fraude: identifier les entrées suspectes

Pagination:
- page: numéro de page (défaut: 1)
- limit: éléments par page (défaut: 10)

Tri: Par date décroissante (les plus récents en premier)

Erreurs possibles:
- 400: Paramètres de pagination invalides
- 401: Non authentifié`,
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
    description: 'Éléments par page (défaut: 10)',
  })
  async getDeposits(@Req() req: any, @Query() query: any) {
    return this.stockService.getDepositList(req.user.userId, query);
  }

  @Get('withdrawals')
  @Auth()
  @ApiOperation({
    summary: 'Journal des sorties de stock (retraits)',
    description: `Récupère l'historique complet de tous les retraits (sorties) de stock pour l'utilisateur avec pagination.

Contenu:
- Type: RETRAIT ou RETOUR
- Produit: ID, nom, quantité
- Source: Qui a retiré (initiateur)
- Site d'origine
- Quantité sortante
- Destination (qui reçoit le retrait)
- Date du mouvement
- Validateur (qui a autorisé)
- Motif du retrait (vente, échange, perte, usage)
- Notes/commentaires

Différence Retrait vs Retour:
- RETRAIT: Vente ou cession normale
- RETOUR: Annulation d'un précédent dépôt

Utilisation:
- Audit: tracer toutes les sorties
- Réconciliation: vérifier conformité stock/ventes
- Inventaire: historique des mouvements
- Retraçabilité: qui a pris quoi et quand
- Détection fraude: identifier les sorties anormales
- Suivi clients: ce qui a été vendu

Pagination:
- page: numéro de page (défaut: 1)
- limit: éléments par page (défaut: 10)

Tri: Par date décroissante (les plus récents en premier)

Erreurs possibles:
- 400: Paramètres de pagination invalides
- 401: Non authentifié`,
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
    description: 'Éléments par page (défaut: 10)',
  })
  async getWithdrawals(@Req() req: any, @Query() query: any) {
    return this.stockService.getWithdrawList(req.user.userId, query);
  }

  // ==========================================
  // VALIDATION DES MOUVEMENTS
  // ==========================================

  @Post('flag-movement/:movementId')
  @Auth()
  @ApiOperation({
    summary: 'Signaler un mouvement comme suspect/invalide',
    description: `Signale un mouvement existant comme problématique ou nécessitant vérification.

Flux métier:
1. Utilisateur identifie un mouvement suspect
2. Crée un signal avec raison spécifique
3. Mouvement marqué comme FLAGGED (signalé)
4. Notifications envoyées aux:
   - Administrateurs pour investigation
   - Validateur original pour explication
   - Détenteur affecté pour correctionéventuelle
5. Stock n'est PAS modifié (mouvement reste valide jusqu'à investigation)
6. Suivi/audit du signal créé
7. Détails du signal stockés pour investigation

Motifs courants:
- Quantité douteuse (plus/moins que prévu)
- Produit abîmé ou non conforme à réception
- Discordance entre registre et référence physique
- Doute sur l'identité du propriétaire
- Transactioncorruptée/enregistrée en double
- Revendication de propriété conflictuelle

Champs requis:
- movementId (path): ID unique du mouvement à signaler
- reason (body): Description détaillée du problème  (1000 caractères max)
- severity (body): low, medium, high (défaut: medium)

Process après signal:
- Admin validera ou annulera le signal
- Ajustements de stock si nécessaire
- Communication avec toutes les parties

Erreurs possibles:
- 400: Raison vide ou trop longue
- 401: Non authentifié
- 404: Mouvement non trouvé
- 409: Mouvement déjà signalé`,
  })
  async flagMovement(
    @Param('movementId') movementId: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.stockService.flagMovement(
      movementId,
      req.user.userId,
      body.reason,
    );
  }

  @Post('validate-movement/:movementId')
  @Auth()
  @ApiOperation({
    summary: 'Valider/confirmer un mouvement signalé',
    description: `Confirme qu'un mouvement FLAGGED peut rester valide après investigation.

Flux métier:
1. Admin/Manager examine le signal et pièces jointes
2. Investigation complétée
3. Décision: mouvement valide et conforme
4. Validation appliquée: flag retiré
5. Mouvement réintégré comme VALIDE
6. Email confirmation aux parties
7. Signal fermé avec résolution confirmée

Préconditions:
- Mouvement doit être en statut FLAGGED
- Admin/Manager authorization requis
- Dossier d'investigation doit exister

Etapes après validation:
- Flag FLAGGED → VALIDATED
- Stock réintégré normalement
- Historique conservé pour audit
- Rapport transmis aux parties intéressées
- Signal fermé avec résolution

Alternatives:
- Rejeter le mouvement (l'annuler complètement)
- Modifier le mouvement (corriger quantité/propriétaire)

Erreurs possibles:
- 401: Non authentifié
- 403: Pas permissions admin
- 404: Mouvement non trouvé
- 409: Mouvement non signalé / pas en statut FLAGGED`,
  })
  async validateMovement(@Param('movementId') movementId: string) {
    return this.stockService.validateMovementFlag(movementId);
  }

  @Get('export')
  @Auth()
  @ApiOperation({ summary: 'Exporter les données en Excel ou PDF' })
  @ApiQuery({ name: 'format', required: true, enum: ['excel', 'pdf'], description: "Format d'export: excel ou pdf" })
  @ApiResponse({ status: 200, description: 'URL du fichier généré' })
  async exportAll(
    @Query('format') format: 'excel' | 'pdf',
    @Req() req: any,
  ) {
    if (!format || !['excel', 'pdf'].includes(format)) {
      throw new BadRequestException('Format invalide. Utilisez "excel" ou "pdf".');
    }
    const userId = req.user?.userId || 'system';
    const fileUrl = await this.stockService.exportAll(format, userId);
    return { status: 'success', file: fileUrl };
  }
}
