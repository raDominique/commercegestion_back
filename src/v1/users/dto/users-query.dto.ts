import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumberString,
  IsBooleanString,
} from 'class-validator';
import { UserType } from '../users.schema';

export class UsersQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @IsOptional()
  @IsBooleanString()
  isVerified?: string;
}
