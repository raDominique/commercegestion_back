import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserType } from './users.schema';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ========================= PAGINATED FIND =========================
  @Get('all-paginated')
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

  @Get('export')
  @ApiOperation({ summary: 'Exporter les utilisateurs en Excel ou PDF' })
  @ApiQuery({ name: 'format', required: true, enum: ['excel', 'pdf'], description: "Format d'export" })
  @ApiResponse({ status: 200, description: 'URL du fichier généré' })
  async exportAll(@Query('format') format: 'excel' | 'pdf') {
    if (!format || !['excel', 'pdf'].includes(format)) {
      throw new BadRequestException('Format invalide. Utilisez "excel" ou "pdf".');
    }
    const fileUrl = await this.usersService.exportAll(format);
    return { status: 'success', file: fileUrl };
  }
}
