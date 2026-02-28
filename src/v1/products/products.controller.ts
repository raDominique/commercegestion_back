import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Auth, AuthRole } from '../auth';
import { UserAccess } from '../users/users.schema';

@ApiTags('Produits')
@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ==========================================
  // SECTION : ACTIONS UTILISATEUR (ÉCRITURE)
  // ==========================================

  @Post()
  @Auth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Créer un nouveau produit',
    description:
      'Crée un produit avec les informations CPC et une image obligatoire.',
  })
  @ApiResponse({
    status: 201,
    description: 'Le produit a été créé avec succès.',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou doublon détecté.',
  })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.create(dto, req.user.userId, file);
  }

  @Patch('update/:id')
  @Auth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Mettre à jour un produit existant',
    description:
      "Permet de modifier les informations d'un produit. L'image est facultative.",
  })
  @ApiParam({ name: 'id', description: 'MongoDB ID du produit' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Produit mis à jour avec succès.' })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé (Propriétaire uniquement).',
  })
  @ApiResponse({ status: 404, description: 'Produit introuvable.' })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.update(id, dto, req.user.userId, file);
  }

  @Delete('delete/:id')
  @Auth()
  @ApiOperation({ summary: 'Supprimer un produit' })
  @ApiParam({ name: 'id', description: 'ID du produit à supprimer' })
  @ApiResponse({ status: 200, description: 'Produit supprimé.' })
  @ApiResponse({ status: 403, description: 'Action interdite.' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.productService.delete(id, req.user.userId);
  }

  // ==========================================
  // SECTION : ACTIONS DE BASCULE (TOGGLES)
  // ==========================================

  /*
  @Patch('toggle-stock/:id')
  @Auth()
  @ApiOperation({
    summary: 'Basculer le statut de stockage',
    description: 'Inverse l\'état "En stock / Hors stock" du produit.',
  })
  @ApiResponse({ status: 200, description: 'Statut mis à jour.' })
  async toggleStock(@Param('id') id: string, @Req() req: any) {
    return this.productService.toggleStock(id, req.user?.userId);
  }
  */
  @Patch('toggle-validation/:id')
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Valider/Invalider un produit (ADMIN)',
    description:
      "Permet à un administrateur d'approuver ou de rejeter un produit.",
  })
  @ApiResponse({ status: 200, description: 'État de validation modifié.' })
  async toggleValidation(@Param('id') id: string) {
    return this.productService.toggleProductValidation(id);
  }

  // ==========================================
  // SECTION : RÉCUPÉRATION DES DONNÉES
  // ==========================================

  @Get()
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Lister tous les produits (Admin)',
    description: 'Récupère la liste globale triée (Hors stock en premier).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isStocker', required: false, type: Boolean })
  @ApiQuery({ name: 'validation', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Liste récupérée.',
    schema: {
      example: {
        status: 'success',
        message: 'Liste récupérée',
        data: [
          {
            _id: '65dcf...',
            image: '/upload/products/hash.jpg',
            name: 'Blé dur',
            categoryNom: 'Céréales',
            ownerName: 'Jean Dupont',
            validation: false,
            isStocker: false,
            codeCPC: '01111',
          },
        ],
        total: 100,
        page: 1,
        limit: 10,
      },
    },
  })
  async findAll(@Query() query: any, @Req() req: any) {
    const userId = req.user?.userId;
    const isAdmin = req.user?.userAccess === UserAccess.ADMIN;
    return this.productService.findAll(query, userId, isAdmin);
  }

  @Get('me')
  @Auth()
  @ApiOperation({
    summary: 'Mes produits',
    description:
      "Récupère uniquement les produits appartenant à l'utilisateur connecté.",
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isStocker', required: false, type: Boolean })
  @ApiQuery({ name: 'validation', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Vos produits ont été récupérés.' })
  async getMyProducts(@Query() query: any, @Req() req: any) {
    const userId = req.user?.userId;
    return this.productService.findAll(query, userId, false);
  }

  @Get('get-by-id/:id')
  @Auth()
  @ApiOperation({ summary: "Détails d'un produit" })
  @ApiParam({ name: 'id', description: 'ID du produit' })
  @ApiResponse({ status: 200, description: 'Produit trouvé.' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé.' })
  async findById(@Param('id') id: string, @Req() req: any) {
    return this.productService.findById(id, req.user?.userId);
  }

  @Get('shop')
  @ApiOperation({
    summary: 'Récupérer les produits disponibles pour le shop',
    description:
      'Récupère les produits validés par un admin et actuellement en stock.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des produits récupérée avec succès.',
  })
  @ApiResponse({ status: 400, description: 'Paramètres de requête invalides.' })
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
    name: 'sort',
    required: false,
    type: String,
    description: 'Champ pour le tri',
    example: 'createdAt',
    enum: ['createdAt', 'productName', 'codeCPC'],
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: Number,
    description: 'Ordre de tri: 1 pour Ascendant, -1 pour Descendant',
    example: -1,
  })
  async getShopProducts(@Query() query: any) {
    return this.productService.getActiveProducts(query);
  }
}
