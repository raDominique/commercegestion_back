import { BadRequestException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { ActifsService } from '../../v1/actifs/actifs.service';
import { PassifsService } from '../../v1/passifs/passifs.service';

/**
 * Service V2 des mouvements (dépôt, virement, échange, retrait).
 * Règles métier centralisées pour éviter les conflits avec V1 :
 * - aucun passif de quantité 0
 * - pas de doublon actif/passif
 * - les passifs concernent toujours les détenteurs, jamais les échangeurs
 * - cohérence actif >= somme des passifs
 */
@Injectable()
export class MovementsService {
  constructor(
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
  ) {}

  private validateQuantity(quantite: number): void {
    if (!Number.isFinite(quantite) || quantite <= 0) {
      throw new BadRequestException('La quantité doit être strictement positive');
    }
  }

  /**
   * Dépôt d'un bien par un ayant droit chez un détenteur.
   * Si détenteur = ayant droit : une seule ligne d'actif, aucun passif.
   */
  async deposit(params: {
    ayantDroitId: string;
    detentaireId: string;
    depotId: string;
    productId: string;
    quantite: number;
    prixUnitaire: number;
    siteOrigineId?: string;
  }) {
    const {
      ayantDroitId,
      detentaireId,
      depotId,
      productId,
      quantite,
      prixUnitaire,
      siteOrigineId,
    } = params;
    this.validateQuantity(quantite);

    if (siteOrigineId) {
      try {
        await this.actifsService.confirmPendingActif(
          ayantDroitId,
          siteOrigineId,
          productId,
          quantite,
        );
      } catch {
        // stock externe : aucune réservation à confirmer
      }
    }

    // Actif du propriétaire légal
    await this.actifsService.addOrIncreaseActif(
      ayantDroitId,
      depotId,
      productId,
      quantite,
      prixUnitaire,
      detentaireId,
      ayantDroitId,
    );

    if (detentaireId !== ayantDroitId) {
      // Actif miroir du détenteur
      await this.actifsService.addOrIncreaseActif(
        detentaireId,
        depotId,
        productId,
        quantite,
        prixUnitaire,
        detentaireId,
        ayantDroitId,
      );

      // Passif du détenteur envers l'ayant droit (jamais 0)
      await this.passifsService.addOrIncreasePassif(
        detentaireId,
        depotId,
        productId,
        quantite,
        ayantDroitId,
      );
    }

    return { status: 'success', message: 'Dépôt appliqué' };
  }

  /**
   * Virement de droit entre deux ayants droit chez un même détenteur.
   * Ignoré si réflexif (from === to).
   */
  async transferRight(params: {
    detentaireId: string;
    depotId: string;
    productId: string;
    fromAyantDroitId: string;
    toAyantDroitId: string;
    quantite: number;
    prixUnitaire: number;
  }) {
    const {
      detentaireId,
      depotId,
      productId,
      fromAyantDroitId,
      toAyantDroitId,
      quantite,
      prixUnitaire,
    } = params;
    this.validateQuantity(quantite);

    if (fromAyantDroitId === toAyantDroitId) {
      return { status: 'success', message: 'Virement réflexif ignoré' };
    }

    await this.actifsService.transferAyantDroitWithinDetentaire({
      detentaireId,
      depotId,
      productId,
      fromAyantDroitId,
      toAyantDroitId,
      quantite,
      prixUnitaire,
    });

    await this.passifsService.transferDebtorByCreditor({
      fromDebtorId: detentaireId,
      toDebtorId: detentaireId,
      productId,
      creancierId: detentaireId,
      quantite,
      depotId,
    });

    return { status: 'success', message: 'Virement de droit appliqué' };
  }

  /**
   * Échange de deux actifs entre deux membres.
   * Les passifs impactés sont ceux des détenteurs (W et Y), pas des échangeurs.
   */
  async exchange(params: {
    acheteurId: string;
    vendeurId: string;
    productAId: string;
    productBId: string;
    quantiteA: number;
    quantiteB: number;
    detentaireAId: string;
    depotAId: string;
    detentaireBId: string;
    depotBId: string;
  }) {
    const {
      acheteurId,
      vendeurId,
      productAId,
      productBId,
      quantiteA,
      quantiteB,
      detentaireAId,
      depotAId,
      detentaireBId,
      depotBId,
    } = params;
    this.validateQuantity(quantiteA);
    this.validateQuantity(quantiteB);

    if (acheteurId === vendeurId) {
      return { status: 'success', message: 'Échange réflexif ignoré' };
    }

    // A : vendeur -> acheteur, détenteur A inchangé
    await this.actifsService.transferAyantDroitWithinDetentaire({
      detentaireId: detentaireAId,
      depotId: depotAId,
      productId: productAId,
      fromAyantDroitId: vendeurId,
      toAyantDroitId: acheteurId,
      quantite: quantiteA,
      prixUnitaire: 0,
    });

    if (detentaireAId !== vendeurId || detentaireAId !== acheteurId) {
      await this.passifsService.transferDebtorByCreditor({
        fromDebtorId: vendeurId,
        toDebtorId: acheteurId,
        productId: productAId,
        creancierId: detentaireAId,
        quantite: quantiteA,
        depotId: depotAId,
      });
    }

    // B : acheteur -> vendeur, détenteur B inchangé
    await this.actifsService.transferAyantDroitWithinDetentaire({
      detentaireId: detentaireBId,
      depotId: depotBId,
      productId: productBId,
      fromAyantDroitId: acheteurId,
      toAyantDroitId: vendeurId,
      quantite: quantiteB,
      prixUnitaire: 0,
    });

    if (detentaireBId !== acheteurId || detentaireBId !== vendeurId) {
      await this.passifsService.transferDebtorByCreditor({
        fromDebtorId: acheteurId,
        toDebtorId: vendeurId,
        productId: productBId,
        creancierId: detentaireBId,
        quantite: quantiteB,
        depotId: depotBId,
      });
    }

    return { status: 'success', message: 'Échange appliqué' };
  }

  /**
   * Retrait : le propriétaire récupère physiquement le bien.
   * Le passif du détenteur est réduit, l'actif est déplacé.
   */
  async withdraw(params: {
    detentaireId: string;
    ayantDroitId: string;
    productId: string;
    siteOrigineId: string;
    siteDestinationId: string;
    quantite: number;
    prixUnitaire: number;
  }) {
    const {
      detentaireId,
      ayantDroitId,
      productId,
      siteOrigineId,
      siteDestinationId,
      quantite,
      prixUnitaire,
    } = params;
    this.validateQuantity(quantite);

    await this.actifsService.confirmPendingActif(
      ayantDroitId,
      siteOrigineId,
      productId,
      quantite,
      { detentaireId, ayantDroitId },
    );

    if (detentaireId !== ayantDroitId) {
      await this.actifsService.confirmPendingActif(
        detentaireId,
        siteOrigineId,
        productId,
        quantite,
        { detentaireId, ayantDroitId },
      );
      await this.passifsService.confirmPendingPassif(
        detentaireId,
        productId,
        ayantDroitId,
        quantite,
      );
    }

    await this.actifsService.addOrIncreaseActif(
      ayantDroitId,
      siteDestinationId,
      productId,
      quantite,
      prixUnitaire,
      ayantDroitId,
      ayantDroitId,
    );

    return { status: 'success', message: 'Retrait appliqué' };
  }
}
