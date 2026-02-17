import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  // ==================== IDENTITÉ ====================
  @ApiProperty({ example: 'jacquinot' })
  @IsString()
  userNickName: string;

  @ApiProperty({ example: 'RANDRIANOMENJANAHARY' })
  @IsString()
  userName: string;

  @ApiProperty({ example: 'Jacquinot' })
  @IsString()
  userFirstname: string;

  @ApiProperty({ example: 'jacquinot@gmail.com' })
  @IsEmail()
  userEmail: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  userPassword: string;

  @ApiPropertyOptional({ example: '+261340179345' })
  @IsOptional()
  @IsString()
  userPhone?: string;

  @ApiPropertyOptional({
    example: 'Entreprise',
    enum: ['Particulier', 'Professionnel', 'Entreprise'],
  })
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiPropertyOptional({ example: 'Andrainjato, Fianarantsoa' })
  @IsOptional()
  @IsString()
  userAddress?: string;

  @ApiPropertyOptional({ example: 48.8566 })
  @IsOptional()
  userMainLat?: number;

  @ApiPropertyOptional({ example: 2.3522 })
  @IsOptional()
  userMainLng?: number;

  // ==================== DOCUMENTS ====================
  @ApiPropertyOptional({ example: '303' })
  @IsOptional()
  @IsString()
  identityCardNumber?: string;

  @ApiPropertyOptional({
    example: 'cin',
    enum: ['cin', 'passport', 'permis-de-conduire'],
  })
  @IsOptional()
  @IsString()
  documentType?: string;

  // ==================== PROFESSIONNEL ====================
  @ApiPropertyOptional({ example: 'RANDRIAN SARL' })
  @IsOptional()
  @IsString()
  raisonSocial?: string;

  @ApiPropertyOptional({ example: '12345678901' })
  @IsOptional()
  @IsString()
  nif?: string;

  @ApiPropertyOptional({ example: 'MG2024001234' })
  @IsOptional()
  @IsString()
  rcs?: string;

  @ApiPropertyOptional({ example: 'Entreprise' })
  @IsOptional()
  @IsString()
  type?: string;

  // ------------------ Manager obligatoire si Entreprise ------------------
  @ApiPropertyOptional({ example: 'Manager' })
  @ValidateIf((o) => o.userType === 'Entreprise')
  @IsString({ message: 'managerName est obligatoire pour les entreprises' })
  managerName?: string;

  @ApiPropertyOptional({ example: 'manager@example.com' })
  @ValidateIf((o) => o.userType === 'Entreprise')
  @IsEmail(
    {},
    { message: 'managerEmail doit être un email valide pour les entreprises' },
  )
  managerEmail?: string;

  // ==================== PARRAINAGE ====================
  @ApiPropertyOptional({ example: 'userId1' })
  @IsOptional()
  @IsString()
  parrain1ID?: string;

  @ApiPropertyOptional({ example: 'userId2' })
  @IsOptional()
  @IsString()
  parrain2ID?: string;
}
