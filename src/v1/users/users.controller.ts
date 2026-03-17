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
  Req,
  ForbiddenException,
  BadRequestException,
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
import { UsersQueryDto } from './dto/users-query.dto';

@ApiTags('Users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
        userNickName: {
          type: 'string',
          example: 'jacquinot',
          description: "Surnom ou pseudo de l'utilisateur",
        },
        userName: {
          type: 'string',
          example: 'RANDRIANOMENJANAHARY',
          description: "Nom de famille de l'utilisateur",
        },
        userFirstname: {
          type: 'string',
          example: 'Jacquinot',
          description: "Prénom de l'utilisateur",
        },
        userEmail: {
          type: 'string',
          example: 'jacquinot@gmail.com',
          description: "Adresse email de l'utilisateur",
        },
        userPassword: {
          type: 'string',
          example: 'StrongPassword123',
          description: "Mot de passe de l'utilisateur",
        },
        userPhone: {
          type: 'string',
          example: '+261340179345',
          description: "Numéro de téléphone de l'utilisateur",
        },
        userDateOfBirth: {
          type: 'string',
          format: 'date',
          example: '1990-01-01',
          description: "Date de naissance de l'utilisateur",
        },
        userType: {
          type: 'string',
          enum: Object.values(UserType),
          example: 'Particulier',
          description: "Type d'utilisateur (Particulier, Entreprise)",
        },
        userAddress: {
          type: 'string',
          example: 'Andrainjato, Fianarantsoa',
          description: "Adresse principale de l'utilisateur",
        },
        userMainLat: {
          type: 'number',
          example: -21.45267,
          description: "Latitude de l'adresse principale",
        },
        userMainLng: {
          type: 'number',
          example: 47.08569,
          description: "Longitude de l'adresse principale",
        },
        identityCardNumber: {
          type: 'string',
          example: '201011000123',
          description: 'Numéro CIN ou Passport',
        },
        documentType: {
          type: 'string',
          enum: ['cin', 'passport', 'permis-de-conduire'],
          example: 'cin',
          description: 'Type de document d’identité fourni',
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
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image de la carte statistique( recto/verso)',
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
        managerName: {
          type: 'string',
          example: 'Jean Dupont',
          description: "Nom du gérant (obligatoire si userType = 'Entreprise')",
        },
        managerEmail: {
          type: 'string',
          format: 'email',
          example: 'manager@entreprise.com',
          description:
            "Email du gérant (obligatoire si userType = 'Entreprise')",
        },
        parrain1ID: {
          type: 'string',
          example: 'XJ8K2P9W',
          description: 'Code de parrainage (8 caractères) du premier parrain',
        },
        parrain2ID: {
          type: 'string',
          example: 'L4N7M1Q5',
          description: 'Code de parrainage (8 caractères) du deuxième parrain',
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
        { name: 'carteStat', maxCount: 5 },
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
    // Sécurité : si aucun fichier n'est envoyé, 'files' peut être undefined
    const safeFiles = files || {};

    const carteStatCount = safeFiles.carteStat ? safeFiles.carteStat.length : 0;
    const documentsCount = safeFiles.documents ? safeFiles.documents.length : 0;
    const carteFiscalCount = safeFiles.carteFiscal
      ? safeFiles.carteFiscal.length
      : 0;

    console.log(
      `Received files - Avatar: ${safeFiles.avatar ? safeFiles.avatar.length : 0}, Logo: ${safeFiles.logo ? safeFiles.logo.length : 0}, CarteStat: ${carteStatCount}, Documents: ${documentsCount}, CarteFiscal: ${carteFiscalCount}`,
    );

    return this.usersService.createWithFiles(dto, {
      avatar: safeFiles.avatar?.[0], // On prend le premier pour les champs uniques
      logo: safeFiles.logo?.[0],
      carteStat: safeFiles.carteStat || [], // Tableau vide par défaut
      documents: safeFiles.documents || [],
      carteFiscal: safeFiles.carteFiscal || [],
    });
  }

  // ========================= VALIDATE PARRAINAGE TOKEN =========================
  @Post('validate-parrain/:id')
  @ApiOperation({
    summary: 'Valider le parrainage par _id du filleul',
    description:
      'Validation du parrainage en cliquant sur la bouton approuver dans la liste du filleul. **Nécessite d’être connecté et d’être le parrain concerné.**',
  })
  @ApiParam({ name: 'id', example: '64d2f3b9e7b9c9b1f1c12345' })
  @Auth()
  async validateParrain(@Req() req, @Param('id') id: string) {
    return await this.usersService.validateParrain(id, req.user.userIdPartager);
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
        userNickName: {
          type: 'string',
          example: 'jacquinot',
          description: "Surnom ou pseudo de l'utilisateur",
        },
        userName: {
          type: 'string',
          example: 'RANDRIANOMENJANAHARY',
          description: "Nom de famille de l'utilisateur",
        },
        userFirstname: {
          type: 'string',
          example: 'Jacquinot',
          description: "Prénom de l'utilisateur",
        },
        userPassword: {
          type: 'string',
          example: 'StrongPassword123',
          description: "Mot de passe de l'utilisateur",
        },
        userPhone: {
          type: 'string',
          example: '+261340179345',
          description: "Numéro de téléphone de l'utilisateur",
        },
        userDateOfBirth: {
          type: 'string',
          format: 'date',
          example: '1990-01-01',
          description: "Date de naissance de l'utilisateur",
        },
        userType: {
          type: 'string',
          enum: Object.values(UserType),
          example: 'Particulier',
          description: "Type d'utilisateur (Particulier, Entreprise)",
        },
        userAddress: {
          type: 'string',
          example: 'Andrainjato, Fianarantsoa',
          description: "Adresse principale de l'utilisateur",
        },
        userMainLat: {
          type: 'number',
          example: -21.45267,
          description: "Latitude de l'adresse principale",
        },
        userMainLng: {
          type: 'number',
          example: 47.08569,
          description: "Longitude de l'adresse principale",
        },
        identityCardNumber: {
          type: 'string',
          example: '201011000123',
          description: 'Numéro CIN ou Passport',
        },
        documentType: {
          type: 'string',
          enum: ['cin', 'passport', 'permis-de-conduire'],
          example: 'cin',
          description: 'Type de document d’identité fourni',
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
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Image de la carte statistique( recto/verso)',
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
        managerName: {
          type: 'string',
          example: 'Jean Dupont',
          description: "Nom du gérant (obligatoire si userType = 'Entreprise')",
        },
        managerEmail: {
          type: 'string',
          format: 'email',
          example: 'manager@entreprise.com',
          description:
            "Email du gérant (obligatoire si userType = 'Entreprise')",
        },
        parrain1ID: {
          type: 'string',
          example: 'XJ8K2P9W',
          description: 'Code de parrainage (8 caractères) du premier parrain',
        },
        parrain2ID: {
          type: 'string',
          example: 'L4N7M1Q5',
          description: 'Code de parrainage (8 caractères) du deuxième parrain',
        },
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
      carteStat: files.carteStat,
      documents: files.documents,
      carteFiscal: files.carteFiscal,
    });
  }

  // ========================= DELETE (SOFT) =========================
  @Delete('delete/:id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Suppression logique (ADMIN)',
    description:
      'Désactive le compte (Soft Delete). Un admin ne peut pas supprimer son propre compte.',
  })
  @ApiParam({ name: 'id', description: "ID MongoDB de l'utilisateur" })
  async remove(@Req() req: any, @Param('id') id: string) {
    // 1. Empêcher l'auto-suppression
    if (req.user.userId === id) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte admin.',
      );
    }

    // 2. Appeler le service
    return await this.usersService.remove(id);
  }

  // ========================= VERIFY ACCOUNT SECURISE =========================
  @Get('verify')
  @ApiOperation({ summary: "Vérifier l'adresse email et rediriger" })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Jeton de sécurité unique',
  })
  @ApiResponse({ status: 302, description: 'Redirection vers le frontend' })
  @ApiResponse({ status: 400, description: 'Token manquant' })
  @HttpCode(HttpStatus.FOUND)
  async verifyAccount(
    @Query('token') token: string,
    @Res() res: express.Response,
  ) {
    if (!token?.trim()) {
      throw new BadRequestException('Token manquant');
    }

    const redirectUrl = await this.usersService.verifyAccountToken(token);
    return res.redirect(HttpStatus.FOUND, redirectUrl);
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

  @Patch('toggle-role/:id')
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({ summary: 'Basculer rôle ADMIN/UTILISATEUR' })
  toggleRole(@Param('id') id: string) {
    return this.usersService.toggleAdminRole(id);
  }

  @Get('select/all')
  @ApiOperation({ summary: 'Liste de tous les utilisateurs (sans pagination)' })
  findAll() {
    return this.usersService.findAllNoPaginated();
  }

  /**
   * Récupérer tous les utilisateurs qui ont choisi l’utilisateur courant comme parrain
   */
  @Get('me/referrals')
  @Auth()
  @ApiOperation({
    summary: 'Liste paginée des filleuls',
    description:
      "Retourne les utilisateurs ayant choisi l'utilisateur courant comme parrain.",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Recherche par nom ou email',
  })
  @ApiQuery({ name: 'userType', required: false, enum: UserType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  async findAllReferrals(@Req() req: any, @Query() query: UsersQueryDto) {
    const {
      page = '1',
      limit = '10',
      search,
      sortBy = 'createdAt',
      order = 'desc',
      userType,
      isActive,
      isVerified,
    } = query;

    const filter = {
      ...(userType && { userType }),
      isActive:
        isActive === undefined ? undefined : String(isActive) === 'true',
      isVerified:
        isVerified === undefined ? undefined : String(isVerified) === 'true',
    };

    // Nettoyer les undefined pour ne pas polluer la query
    Object.keys(filter).forEach(
      (key) => filter[key] === undefined && delete filter[key],
    );

    return this.usersService.findAllByFilsPaginated(
      req.user.userIdPartager,
      Number(page),
      Number(limit),
      search,
      sortBy,
      order,
      filter,
    );
  }

  // ========================= PAGINATED FIND =========================
  @Get()
  @ApiOperation({
    summary: 'Recherche et pagination des utilisateurs',
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
  findAllPaginated(@Query() query: UsersQueryDto) {
    const {
      page = '1',
      limit = '10',
      search,
      sortBy = 'createdAt',
      order = 'desc',
      userType,
      isActive,
      isVerified,
    } = query;

    const filter = {
      ...(userType && { userType }),
      isActive:
        isActive === undefined ? undefined : String(isActive) === 'true',
      isVerified:
        isVerified === undefined ? undefined : String(isVerified) === 'true',
    };

    // Nettoyer les undefined pour ne pas polluer la query
    Object.keys(filter).forEach(
      (key) => filter[key] === undefined && delete filter[key],
    );

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
