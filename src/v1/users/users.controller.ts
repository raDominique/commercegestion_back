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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserAccess, UserType } from './users.schema';
import { Auth, AuthRole } from '../auth';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ========================= CREATE =========================
  @Post()
  @ApiOperation({
    summary: 'Create a new user',
    description:
      'Creates a new user account. By default, the user is created as BUYER, inactive and not verified.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({
    description: 'User successfully created',
    type: User,
  })
  @ApiBadRequestResponse({
    description: 'Email already exists or invalid payload',
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
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
    summary: 'Update a user',
    description: 'Updates user information (partial update).',
  })
  @ApiParam({
    name: 'id',
    description: 'User MongoDB ObjectId',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User updated successfully',
    type: User,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @Auth()
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
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

  // ========================= VERIFY ACCOUNT =========================
  @Patch('verify/:id')
  @ApiOperation({
    summary: 'Verify user account',
    description:
      'Marks the user account as verified. Required before activation.',
  })
  @ApiParam({
    name: 'id',
    description: 'User MongoDB ObjectId',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User account verified',
    type: User,
  })
  @ApiBadRequestResponse({
    description: 'Account already verified',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  verifyAccount(@Param('id') id: string) {
    return this.usersService.verifyAccount(id);
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
      isActive: isActive === undefined ? undefined : String(isActive) === 'true',
      isVerified: isVerified === undefined ? undefined : String(isVerified) === 'true',
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
