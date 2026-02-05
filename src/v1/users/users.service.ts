import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Error as MongooseError } from 'mongoose';
import { User, UserDocument, UserType } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/v1/shared/interfaces/pagination.interface';

@Injectable()
export class UsersService {
  private readonly context = 'UsersService';

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly logger: LoggerService,
  ) {}

  // ========================= CREATE USER =========================
  async create(dto: CreateUserDto): Promise<PaginationResult<User>> {
    try {
      const exists = await this.userModel.findOne({
        email: dto.email,
        deletedAt: null,
      });
      if (exists) {
        this.logger.warn(
          this.context,
          `Attempt to create duplicate email: ${dto.email}`,
        );
        throw new BadRequestException('Email already exists');
      }

      const user = new this.userModel({
        ...dto,
        userType: UserType.BUYER,
        isVerified: false,
        isActive: false,
        balance: 0,
      });

      const createdUser = await user.save();
      this.logger.log(this.context, `User created: ${createdUser._id}`);

      return {
        status: 'success',
        message: 'User created successfully',
        data: [createdUser],
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      if (error?.code === 11000) {
        this.logger.warn(
          this.context,
          `Duplicate key error: ${JSON.stringify(error.keyValue)}`,
        );
        throw new BadRequestException('Email already exists');
      }

      this.logger.error(this.context, 'Failed to create user', error.stack);
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  // ========================= FIND ALL =========================
  async findAll(): Promise<PaginationResult<User>> {
    try {
      const users = await this.userModel
        .find({ deletedAt: null })
        .select('-password')
        .exec();
      this.logger.log(this.context, `Fetched all users: count=${users.length}`);

      return {
        status: 'success',
        message: 'Users fetched successfully',
        data: users,
      };
    } catch (error) {
      this.logger.error(this.context, 'Failed to fetch users', error.stack);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  // ========================= FIND ONE =========================
  async findOne(id: string): Promise<PaginationResult<User>> {
    try {
      const user = await this.userModel
        .findOne({ _id: id, deletedAt: null })
        .select('-password')
        .exec();

      if (!user) {
        this.logger.warn(this.context, `User not found: ${id}`);
        throw new NotFoundException('User not found');
      }

      this.logger.log(this.context, `User fetched: ${id}`);
      return {
        status: 'success',
        message: 'User fetched successfully',
        data: [user],
      };
    } catch (error) {
      if (error instanceof MongooseError.CastError) {
        throw new BadRequestException('Invalid user id');
      }
      throw error;
    }
  }

  // ========================= UPDATE =========================
  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<PaginationResult<User>> {
    try {
      const user = await this.userModel.findOne({ _id: id, deletedAt: null });
      if (!user) {
        this.logger.warn(
          this.context,
          `Attempt to update non-existing user: ${id}`,
        );
        throw new NotFoundException('User not found');
      }

      Object.assign(user, dto);
      await user.save();
      this.logger.log(this.context, `User updated: ${id}`);

      return this.findOne(id);
    } catch (error) {
      this.logger.error(
        this.context,
        `Failed to update user: ${id}`,
        error.stack,
      );
      if (error instanceof MongooseError.CastError) {
        throw new BadRequestException('Invalid user id');
      }
      throw error;
    }
  }

  // ========================= SOFT DELETE =========================
  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) {
      this.logger.warn(
        this.context,
        `Attempt to delete non-existing user: ${id}`,
      );
      throw new NotFoundException('User not found');
    }

    user.deletedAt = new Date();
    user.isActive = false;
    await user.save();

    this.logger.log(this.context, `User soft-deleted: ${id}`);
    return {
      status: 'success',
      message: 'User deleted successfully',
      data: null,
    };
  }

  // ========================= VERIFY ACCOUNT =========================
  async verifyAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      this.logger.warn(
        this.context,
        `Verify failed: user not found: ${userId}`,
      );
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      this.logger.warn(
        this.context,
        `Verify failed: user already verified: ${userId}`,
      );
      throw new BadRequestException('Account already verified');
    }

    user.isVerified = true;
    await user.save();
    this.logger.log(this.context, `User verified: ${userId}`);

    return this.findOne(userId);
  }

  // ========================= ACTIVATE ACCOUNT =========================
  async activateAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      this.logger.warn(
        this.context,
        `Activate failed: user not found: ${userId}`,
      );
      throw new NotFoundException('User not found');
    }

    if (!user.isVerified) {
      this.logger.warn(
        this.context,
        `Activate failed: user not verified: ${userId}`,
      );
      throw new BadRequestException(
        'Account must be verified before activation',
      );
    }

    if (user.isActive) {
      this.logger.warn(
        this.context,
        `Activate failed: account already active: ${userId}`,
      );
      throw new BadRequestException('Account already active');
    }

    user.isActive = true;
    await user.save();
    this.logger.log(this.context, `User activated: ${userId}`);

    return this.findOne(userId);
  }


  // ========================= FIND ALL PAGINATED + SEARCH + SORT + FILTER =========================
  async findAllPaginated(
    page = 1,
    limit = 10,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    filter?: Partial<{ userType: UserType; isActive: boolean; isVerified: boolean }>,
  ): Promise<PaginationResult<User>> {
    try {
      const query: any = { deletedAt: null };

      // ------------------ FILTRE ------------------
      if (filter) {
        if (filter.userType) query.userType = filter.userType;
        if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;
        if (typeof filter.isVerified === 'boolean') query.isVerified = filter.isVerified;
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
        this.userModel.find(query).select('-password').sort(sortQuery).skip(skip).limit(limit),
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
