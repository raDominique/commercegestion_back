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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
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

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ========================= CREATE USER + FILES =========================
  @Post()
  @ApiOperation({ summary: 'Create user with avatar and documents' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
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
          enum: ['Particulier', 'Professionnel', 'Entreprise'],
        },
        userAddress: { type: 'string', example: 'Andrainjato, Fianarantsoa' },
        userMainLat: { type: 'number', example: -18.92772195 },
        userMainLng: { type: 'number', example: 47.55809783 },
        identityCardNumber: { type: 'string', example: '303' },
        documentType: {
          type: 'string',
          enum: ['cin', 'passport', 'permis-de-conduire'],
          example: 'cin',
        },
        managerName: { type: 'string', example: 'Manager' },
        managerEmail: { type: 'string', example: 'manager@example.com' },
        raisonSocial: { type: 'string', example: 'RANDRIAN SARL' },
        nif: { type: 'string', example: '12345678901' },
        rcs: { type: 'string', example: 'MG2024001234' },
        parrain1ID: { type: 'string', example: 'userId1' },
        parrain2ID: { type: 'string', example: 'userId2' },
        avatar: { type: 'string', format: 'binary' },
        logo: { type: 'string', format: 'binary' },
        carteStat: { type: 'string', format: 'binary' },
        documents: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        carteFiscal: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
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

  // ========================= FIND ALL =========================
  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Returns all active (not deleted) users without passwords.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of users',
    type: [User],
  })
  findAll() {
    return this.usersService.findAll();
  }

  // ========================= FIND ONE =========================
  @Get('get-by-id/:id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Returns a single user by its MongoDB ObjectId.',
  })
  @ApiParam({
    name: 'id',
    description: 'User MongoDB ObjectId',
    example: '64d2f3b9e7b9c9b1f1c12345',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User found',
    type: User,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // ========================= UPDATE =========================
  @Patch('update/:id')
  @ApiOperation({
    summary: 'Update a user (with files)',
    description:
      'Updates user information and allows updating avatar/documents.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    description: 'User MongoDB ObjectId',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userNickName: { type: 'string', example: 'jacquinot' },
        userName: { type: 'string', example: 'RANDRIANOMENJANAHARY' },
        userFirstname: { type: 'string', example: 'Jacquinot' },
        userEmail: { type: 'string', example: 'jacquinot@gmail.com' },
        userPassword: { type: 'string', example: 'StrongPassword123' },
        userPhone: { type: 'string', example: '+261340179345' },
        userType: {
          type: 'string',
          enum: ['Particulier', 'Professionnel', 'Entreprise'],
        },
        userAddress: { type: 'string', example: 'Andrainjato, Fianarantsoa' },
        userMainLat: { type: 'number', example: -18.92772195 },
        userMainLng: { type: 'number', example: 47.55809783 },
        identityCardNumber: { type: 'string', example: '303' },
        documentType: {
          type: 'string',
          enum: ['cin', 'passport', 'permis-de-conduire'],
          example: 'cin',
        },
        managerName: { type: 'string', example: 'Manager' },
        managerEmail: { type: 'string', example: 'manager@example.com' },
        raisonSocial: { type: 'string', example: 'RANDRIAN SARL' },
        nif: { type: 'string', example: '12345678901' },
        rcs: { type: 'string', example: 'MG2024001234' },
        parrain1ID: { type: 'string', example: 'userId1' },
        parrain2ID: { type: 'string', example: 'userId2' },
        avatar: { type: 'string', format: 'binary' },
        logo: { type: 'string', format: 'binary' },
        carteStat: { type: 'string', format: 'binary' },
        documents: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        carteFiscal: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
    type: User,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @Auth()
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
    return this.usersService.update(
      id,
      {
        ...dto,
      },
      {
        avatar: files.avatar?.[0],
        logo: files.logo?.[0],
        carteStat: files.carteStat?.[0],
        documents: files.documents,
        carteFiscal: files.carteFiscal,
      },
    );
  }

  // ========================= DELETE (SOFT) =========================
  @Delete('delete/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a user (soft delete)',
    description:
      'Soft deletes a user by setting deletedAt and deactivating the account.',
  })
  @ApiParam({
    name: 'id',
    description: 'User MongoDB ObjectId',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @AuthRole(UserAccess.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // ========================= VERIFY ACCOUNT SECURISE =========================
  @Get('verify')
  @ApiOperation({
    summary: 'Verify user account via token',
    description: 'Marks the user account as verified using a secure token.',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Verification token sent by email',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account verified successfully',
    type: User,
  })
  @ApiBadRequestResponse({
    description: 'Token invalide ou expiré',
  })
  @ApiNotFoundResponse({
    description: 'Utilisateur non trouvé',
  })
  async verifyAccount(@Query('token') token: string) {
    return this.usersService.verifyAccountToken(token);
  }

  // ========================= ACTIVATE ACCOUNT =========================
  @Patch('activate/:id')
  @ApiOperation({
    summary: 'Activate user account',
    description:
      'Activates a verified user account. The account must be verified first.',
  })
  @ApiParam({
    name: 'id',
    description: 'User MongoDB ObjectId',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account activated',
    type: User,
  })
  @ApiBadRequestResponse({
    description: 'Account not verified or already active',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @AuthRole(UserAccess.ADMIN)
  activateAccount(@Param('id') id: string) {
    return this.usersService.activateAccount(id);
  }

  // ========================= PAGINATED FIND =========================
  @Get('paginated')
  @ApiOperation({
    summary: 'Get paginated users',
    description:
      'Returns a paginated list of users with optional search, sort and filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated users fetched successfully',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number, default 1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page, default 10',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by email, companyName, contactPerson',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Field to sort by, default createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order, asc or desc, default desc',
  })
  @ApiQuery({
    name: 'userType',
    required: false,
    enum: UserType,
    description: 'Filter by user type',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status',
  })
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
    // Transformer les query strings en types corrects
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
