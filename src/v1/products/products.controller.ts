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
  @ApiOperation({ summary: 'Créer un produit avec une image unique' })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.create(dto, req.user.userId, file);
  }

  // ==========================================
  // MISE À JOUR PRODUIT
  // ==========================================
  @Patch('update/:id')
  @Auth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mettre à jour un produit et son image' })
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.productService.update(id, dto, req.user.userId, file);
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
  // RÉCUPÉRATION (ID)
  // ==========================================
  @Get('get-by-id/:id')
  @Auth()
  @ApiOperation({ summary: 'Récupérer un produit par ID' })
  @ApiParam({ name: 'id', description: 'ID MongoDB du produit' })
  @ApiResponse({ status: 200, description: 'Produit récupéré.' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé.' })
  async findById(@Param('id') id: string, @Req() req: any) {
    return this.productService.findById(id, req.user?.userId);
  }

  // ==========================================
  // VALIDATION ADMIN
  // ==========================================
  @Patch('validate/:id')
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
  @Patch('stock-toggle/:id')
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
  @Delete('delete/:id')
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

  // ==========================================
  // RÉCUPÉRATION LEUR ID
  // ==========================================
  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Récupérer les produits de l’utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Produits récupérés.' })
  @ApiResponse({
    status: 404,
    description: 'Aucun produit trouvé pour cet utilisateur.',
  })
  async getMyProducts(@Req() req: any) {
    return this.productService.getMyProducts(req.user?.userId);
  }
}
