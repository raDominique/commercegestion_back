import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  IsNumber,
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

  @ApiPropertyOptional({ example: -21.4478 }) // Coordonnées Fianarantsoa pour l'exemple
  @IsOptional()
  userMainLat?: number;

  @ApiPropertyOptional({ example: 47.0858 })
  @IsOptional()
  userMainLng?: number;

  // ==================== DOCUMENTS ====================
  @ApiPropertyOptional({ example: '301011000123' })
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

  @ApiPropertyOptional({ example: 'S.A.R.L' })
  @IsOptional()
  @IsString()
  type?: string;

  // ------------------ Manager obligatoire si Entreprise ------------------
  @ApiPropertyOptional({ example: 'Jean Marc' })
  @ValidateIf((o) => o.userType === 'Entreprise')
  @IsString({ message: 'managerName est obligatoire pour les entreprises' })
  managerName?: string;

  @ApiPropertyOptional({ example: 'manager@randrian.mg' })
  @ValidateIf((o) => o.userType === 'Entreprise')
  @IsEmail(
    {},
    { message: 'managerEmail doit être un email valide pour les entreprises' },
  )
  managerEmail?: string;

  // ==================== PARRAINAGE (ID 8 CHARS) ====================
  /**
   * CORRECTION : On utilise des exemples de 8 caractères majuscules/chiffres
   * pour correspondre à votre nouveau middleware.
   */
  @ApiPropertyOptional({ example: 'K7B9X2W4' })
  @IsOptional()
  @IsString()
  parrain1ID?: string;

  @ApiPropertyOptional({ example: 'R4N9M1J8' })
  @IsOptional()
  @IsString()
  parrain2ID?: string;
}
