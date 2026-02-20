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
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { ProductService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Auth } from '../auth';

@ApiTags('Products')
@Controller()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ==========================================
  // CRÉATION PRODUIT
  // ==========================================
  @Post()
  @Auth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Créer un produit avec images',
    description:
      "Crée un nouveau produit. Le champ isStocker est forcé à false. Accepte jusqu'à 5 images.",
  })
  @ApiBody({
    description: 'Données du produit et fichiers images',
    type: CreateProductDto,
  })
  @ApiResponse({ status: 201, description: 'Produit créé avec succès.' })
  @ApiResponse({ status: 400, description: 'Données invalides.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @UseInterceptors(FilesInterceptor('images', 5))
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    return this.productService.create(dto, req.user?.userId || 'anonymous', files);
  }

  // ==========================================
  // RÉCUPÉRATION (LISTE)
  // ==========================================
  @Get()
  @ApiOperation({
    summary: 'Lister les produits',
    description:
      'Récupère la liste des produits avec support pour la pagination et la recherche.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Recherche par nom ou codeCPC',
  })
  @ApiQuery({
    name: 'isStocker',
    required: false,
    type: Boolean,
    description: 'Filtrer par statut de stockage',
  })
  @ApiResponse({ status: 200, description: 'Liste récupérée.' })
  @Auth()
  async findAll(@Query() query: any, @Req() req: any) {
    const userId = req.user?.userId;
    return this.productService.findAll(query, userId);
  }

  // ==========================================
  // VALIDATION ADMIN
  // ==========================================
  @Patch(':id/validate')
  @Auth() // Probablement réservé aux admins dans votre logique
  @ApiOperation({ summary: 'Valider un produit' })
  @ApiParam({ name: 'id', description: 'ID MongoDB du produit' })
  @ApiResponse({ status: 200, description: 'Produit marqué comme validé.' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé.' })
  async validate(@Param('id') id: string, @Req() req: any) {
    return this.productService.validateProduct(id, req.user?.userId);
  }

  // ==========================================
  // TOGGLE STOCK
  // ==========================================
  @Patch(':id/stock-toggle')
  @Auth()
  @ApiOperation({
    summary: 'Inverser le statut de stockage',
    description: 'Bascule isStocker entre true et false.',
  })
  @ApiParam({ name: 'id', description: 'ID MongoDB du produit' })
  @ApiResponse({ status: 200, description: 'Statut de stockage mis à jour.' })
  async toggleStock(@Param('id') id: string, @Req() req: any) {
    return this.productService.toggleStock(id, req.user?.userId);
  }

  // ==========================================
  // SUPPRESSION
  // ==========================================
  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Supprimer un produit' })
  @ApiParam({ name: 'id', description: 'ID MongoDB du produit' })
  @ApiResponse({ status: 200, description: 'Produit supprimé.' })
  @ApiResponse({
    status: 403,
    description: 'Action interdite (Propriétaire uniquement ?).',
  })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.productService.delete(id, req.user?.userId);
  }
}
