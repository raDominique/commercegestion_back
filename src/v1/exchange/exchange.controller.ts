import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../auth';
import { BuyExchangeOfferDto, CreateExchangeOfferDto } from './exchange.dto';
import { ExchangeService } from './exchange.service';

@ApiTags('Exchange')
@Controller('exchange')
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Post('offers')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer une offre d'échange",
    description:
      "Le membre V (vendeur) met en vente un actif A qu'il possède (ayant-droit) et qui est stocké chez un détenteur W, en demandant un produit B en contrepartie.\n\nRègles:\n- `acceptedDetenteurBIds` est obligatoire: liste des détenteurs Y acceptés pour le produit B.\n- Le vendeur doit avoir une quantité suffisante de A chez W (au dépôt `depotAId`).",
  })
  @ApiBody({ type: CreateExchangeOfferDto })
  @ApiResponse({
    status: 201,
    description: 'Offre créée',
    schema: {
      example: {
        status: 'success',
        message: 'Offre d’échange créée',
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            vendeurId: '507f1f77bcf86cd799439001',
            productAId: '507f1f77bcf86cd799439003',
            quantiteA: 10,
            detentaireAId: '507f1f77bcf86cd799439002',
            depotAId: '507f1f77bcf86cd799439004',
            productBId: '507f1f77bcf86cd799439005',
            tauxEchange: 2,
            acceptedDetenteurBIds: [
              '507f1f77bcf86cd799439006',
              '507f1f77bcf86cd799439007',
            ],
            isActive: true,
            createdAt: '2026-06-23T10:30:45.000Z',
          },
        ],
        total: 1,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Requête invalide (ex: détenteurs Y manquants, stock insuffisant, IDs invalides)',
    schema: {
      example: {
        statusCode: 400,
        message:
          'Veuillez renseigner au moins un détenteur accepté (Y) pour le produit de contrepartie (B).',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async createOffer(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: CreateExchangeOfferDto,
  ) {
    return this.exchangeService.createOffer(dto, req.user.userId);
  }

  @Get('offers')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rechercher les offres d'échange",
    description:
      "Retourne les offres actives. Filtres optionnels disponibles: produit A, produit B, détenteur W, détenteur Y accepté, et intervalle de taux d'échange. Pagination: `page` / `limit`.",
  })
  @ApiQuery({
    name: 'productAId',
    required: false,
    description: 'Filtrer par produit A (vendu)',
  })
  @ApiQuery({
    name: 'productBId',
    required: false,
    description: 'Filtrer par produit B (contrepartie)',
  })
  @ApiQuery({
    name: 'detentaireAId',
    required: false,
    description: 'Filtrer par détenteur W du produit A',
  })
  @ApiQuery({
    name: 'acceptedDetenteurBId',
    required: false,
    description: 'Filtrer par détenteur Y accepté pour le produit B',
  })
  @ApiQuery({
    name: 'minTaux',
    required: false,
    description: 'Filtrer tauxEchange >= minTaux',
    example: 1,
  })
  @ApiQuery({
    name: 'maxTaux',
    required: false,
    description: 'Filtrer tauxEchange <= maxTaux',
    example: 5,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page (défaut: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Taille page (défaut: 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste paginée des offres',
    schema: {
      example: {
        status: 'success',
        message: 'Offres d’échange',
        data: [
          {
            _id: '507f1f77bcf86cd799439011',
            vendeurId: { _id: '507f1f77bcf86cd799439001', userName: 'Vendeur' },
            detentaireAId: {
              _id: '507f1f77bcf86cd799439002',
              userName: 'DetenteurW',
            },
            depotAId: { _id: '507f1f77bcf86cd799439004', siteName: 'Depot W' },
            productAId: {
              _id: '507f1f77bcf86cd799439003',
              productName: 'Produit A',
            },
            productBId: {
              _id: '507f1f77bcf86cd799439005',
              productName: 'Produit B',
            },
            quantiteA: 10,
            tauxEchange: 2,
            acceptedDetenteurBIds: [
              { _id: '507f1f77bcf86cd799439006', userName: 'DetY1' },
            ],
            isActive: true,
            createdAt: '2026-06-23T10:30:45.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async searchOffers(@Query() query: any) {
    return this.exchangeService.searchOffers(query);
  }

  @Post('offers/:offerId/buy')
  @Auth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Acheter via une offre d'échange (auto)",
    description:
      "Le membre X (acheteur) achète une quantité de produit A. L'achat est automatique si X possède assez de produit B chez au moins un détenteur Y accepté par l'offre.\n\nMouvements: \n- Droit sur A: V -> X chez W (détenteur A)\n- Droit sur B: X -> V chez Y (détenteur B choisi automatiquement)\n- Passifs associés transférés en cohérence.",
  })
  @ApiParam({
    name: 'offerId',
    description: "ID de l'offre d'échange",
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: BuyExchangeOfferDto })
  @ApiResponse({
    status: 200,
    description: 'Échange effectué',
    schema: {
      example: {
        status: 'success',
        message: 'Échange réalisé',
        data: [
          {
            offerId: '507f1f77bcf86cd799439011',
            quantiteA: 3,
            quantiteB: 6,
            transactionNumber: 'EX-1750000000000',
            detentaireBId: '507f1f77bcf86cd799439006',
            depotBId: '507f1f77bcf86cd799439009',
          },
        ],
        total: 1,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Achat impossible (ex: quantité demandée trop grande, contrepartie insuffisante, offre invalide)',
  })
  @ApiResponse({ status: 404, description: 'Offre introuvable ou inactive' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async buyOffer(
    @Req() req: Request & { user: { userId: string } },
    @Param('offerId') offerId: string,
    @Body() dto: BuyExchangeOfferDto,
  ) {
    return this.exchangeService.buyOffer(offerId, dto, req.user.userId);
  }
}
