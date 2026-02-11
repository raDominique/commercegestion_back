import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserType } from './users.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class UsersService {
  private readonly context = 'UsersService';

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly logger: LoggerService,
  ) {}

  // ========================= FIND ALL PAGINATED + SEARCH + SORT + FILTER =========================
  async findAllPaginated(
    page = 1,
    limit = 10,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    filter?: Partial<{
      userType: UserType;
      isActive: boolean;
      isVerified: boolean;
    }>,
  ): Promise<PaginationResult<User>> {
    try {
      const query: any = { deletedAt: null };

      // ------------------ FILTRE ------------------
      if (filter) {
        if (filter.userType) query.userType = filter.userType;
        if (typeof filter.isActive === 'boolean')
          query.isActive = filter.isActive;
        if (typeof filter.isVerified === 'boolean')
          query.isVerified = filter.isVerified;
      }

      // ------------------ RECHERCHE ------------------
      if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
          { email: regex },
          { companyName: regex },
          { contactPerson: regex },
        ];
      }

      // ------------------ PAGINATION ------------------
      const skip = (page - 1) * limit;

      // ------------------ TRI ------------------
      const sortOrder = order === 'asc' ? 1 : -1;
      const sortQuery: any = {};
      sortQuery[sortBy] = sortOrder;

      // ------------------ EXECUTE ------------------
      const [data, total] = await Promise.all([
        this.userModel
          .find(query)
          .select('-password')
          .sort(sortQuery)
          .skip(skip)
          .limit(limit),
        this.userModel.countDocuments(query),
      ]);

      return {
        status: 'success',
        message: 'Users fetched successfully',
        data,
        page,
        limit,
        total,
      };
    } catch (error) {
      this.logger.error(this.context, 'Failed to fetch users', error.stack);
      throw new BadRequestException('Invalid query parameters');
    }
  }
}
