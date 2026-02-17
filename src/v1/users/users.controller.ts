import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserAccess, UserType } from './users.schema';
import { Auth, AuthRole } from '../auth';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { multerMemoryConfig } from 'src/shared/upload/multer.memory';
import express from 'express';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // ========================= CREATE USER + FILES =========================
  @Post()
  @ApiOperation({
    summary: 'Créer un utilisateur avec documents (Public)',
    description:
      "Inscription d'un nouvel utilisateur avec téléchargement d'images (avatar, logo) et documents officiels (CIN, Carte Statistique, etc.).",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: "Formulaire d'inscription incluant les fichiers binaires",
    schema: {
      type: 'object',
      required: [
        'userNickName',
        'userName',
        'userFirstname',
        'userEmail',
        'userPassword',
      ],
      properties: {
        userNickName: { type: 'string', example: 'jacquinot' },
        userName: { type: 'string', example: 'RANDRIANOMENJANAHARY' },
        userFirstname: { type: 'string', example: 'Jacquinot' },
        userEmail: { type: 'string', example: 'jacquinot@gmail.com' },
        userPassword: { type: 'string', example: 'StrongPassword123' },
        userPhone: { type: 'string', example: '+261340179345' },
        userType: {
          type: 'string',
          enum: Object.values(UserType),
          example: 'Particulier',
        },
        userAddress: { type: 'string', example: 'Andrainjato, Fianarantsoa' },
        userMainLat: { type: 'number', example: -21.45267 },
        userMainLng: { type: 'number', example: 47.08569 },
        identityCardNumber: {
          type: 'string',
          example: '201011000123',
          description: 'Numéro CIN ou Passport',
        },
        documentType: {
          type: 'string',
          enum: ['cin', 'passport', 'permis-de-conduire'],
          example: 'cin',
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Photo de profil',
        },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'Logo pour les entreprises',
        },
        carteStat: {
          type: 'string',
          format: 'binary',
          description: 'Image de la carte statistique',
        },
        documents: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Documents complémentaires (max 5)',
        },
        carteFiscal: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Justificatifs fiscaux (NIF)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé. Un email de vérification a été envoyé.',
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'logo', maxCount: 1 },
        { name: 'carteStat', maxCount: 1 },
        { name: 'documents', maxCount: 5 },
        { name: 'carteFiscal', maxCount: 5 },
      ],
      multerMemoryConfig,
    ),
  )
  async create(
    @Body() dto: CreateUserDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      logo?: Express.Multer.File[];
      carteStat?: Express.Multer.File[];
      documents?: Express.Multer.File[];
      carteFiscal?: Express.Multer.File[];
    },
  ) {
    return this.usersService.createWithFiles(dto, {
      avatar: files.avatar?.[0],
      logo: files.logo?.[0],
      carteStat: files.carteStat?.[0],
      documents: files.documents,
      carteFiscal: files.carteFiscal,
    });
  }

  // ========================= FIND ONE =========================
  @Get('get-by-id/:id')
  @ApiOperation({ summary: "Détails d'un utilisateur" })
  @ApiParam({ name: 'id', example: '64d2f3b9e7b9c9b1f1c12345' })
  @ApiResponse({ status: 200, type: User })
  @ApiNotFoundResponse({ description: 'Utilisateur introuvable.' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ========================= UPDATE =========================
  @Patch('update/:id')
  @Auth()
  @ApiOperation({
    summary: 'Modifier son profil (Utilisateur Connecté)',
    description:
      "Permet de mettre à jour les informations et les fichiers. **Nécessite d'être le propriétaire du compte ou Admin.**",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userNickName: { type: 'string' },
        userPhone: { type: 'string', example: '+261320011122' },
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'documents', maxCount: 5 },
        { name: 'logo', maxCount: 1 },
        { name: 'carteStat', maxCount: 1 },
        { name: 'carteFiscal', maxCount: 5 },
      ],
      multerMemoryConfig,
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      logo?: Express.Multer.File[];
      carteStat?: Express.Multer.File[];
      documents?: Express.Multer.File[];
      carteFiscal?: Express.Multer.File[];
    },
  ) {
    return this.usersService.update(id, dto, {
      avatar: files.avatar?.[0],
      logo: files.logo?.[0],
      carteStat: files.carteStat?.[0],
      documents: files.documents,
      carteFiscal: files.carteFiscal,
    });
  }

  // ========================= DELETE (SOFT) =========================
  @Delete('delete/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Suppression logique (ADMIN)',
    description:
      'Désactive le compte sans supprimer les données de la base (Soft Delete).',
  })
  @ApiParam({ name: 'id', description: "ID MongoDB de l'utilisateur" })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // ========================= VERIFY ACCOUNT SECURISE =========================
  @Get('verify')
  @ApiOperation({
    summary: "Vérifier l'adresse email et rediriger",
    description: 'Endpoint appelé lors du clic sur le lien reçu par email. Redirige vers le Login.',
  })
  @ApiQuery({ name: 'token', description: 'Jeton de sécurité unique' })
  @ApiResponse({ status: 302, description: 'Redirection vers la page de login.' })
  async verifyAccount(@Query('token') token: string, @Res() res: express.Response) {
    try {
      const redirectUrl = await this.usersService.verifyAccountToken(token);
      return res.redirect(redirectUrl);
    } catch (error) {
      throw error;
    }
  }

  // ========================= ACTIVATE ACCOUNT =========================
  @Patch('activate/:id')
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Activer manuellement un compte (ADMIN)',
    description:
      "Permet à l'admin de valider un compte après vérification des documents (KYC).",
  })
  @ApiResponse({ status: 200, description: 'Compte activé avec succès.' })
  activateAccount(@Param('id') id: string) {
    return this.usersService.activateAccount(id);
  }

  // ========================= PAGINATED FIND =========================
  @Get()
  @ApiOperation({
    summary: 'Recherche et Pagination avancée',
    description:
      "Recherche multicritère : par nom, type d'utilisateur (Particulier/Entreprise) ou statut (Actif/Vérifié).",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Recherche par nom, email ou NIF',
  })
  @ApiQuery({ name: 'userType', required: false, enum: UserType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  findAllPaginated(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('userType') userType?: UserType,
    @Query('isActive') isActive?: boolean,
    @Query('isVerified') isVerified?: boolean,
  ) {
    const filter = {
      userType,
      isActive:
        isActive === undefined ? undefined : String(isActive) === 'true',
      isVerified:
        isVerified === undefined ? undefined : String(isVerified) === 'true',
    };
    return this.usersService.findAllPaginated(
      Number(page),
      Number(limit),
      search,
      sortBy,
      order,
      filter,
    );
  }
}
