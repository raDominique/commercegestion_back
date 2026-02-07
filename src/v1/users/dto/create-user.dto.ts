import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  // ==================== IDENTITÉ PERSONNELLE ====================
  @ApiProperty({
    example: 'jacquinot',
    description: "Le surnom/pseudo de l'utilisateur",
  })
  @IsString()
  userNickName: string;

  @ApiProperty({
    example: 'RANDRIANOMENJANAHARY',
    description: 'Nom de famille',
  })
  @IsString()
  userName: string;

  @ApiProperty({
    example: 'Jacquinot',
    description: 'Prénom',
  })
  @IsString()
  userFirstname: string;

  @ApiProperty({
    example: 'randrianomenjanaharyjacquinot@gmail.com',
    description: "L'adresse email de l'utilisateur. Doit être unique et valide.",
  })
  @IsEmail()
  userEmail: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: "Le mot de passe de l'utilisateur. Minimum 8 caractères.",
  })
  @IsString()
  @MinLength(8)
  userPassword: string;

  @ApiPropertyOptional({
    example: '+261 34 01 793 45',
    description: "Numéro de téléphone de l'utilisateur (optionnel).",
  })
  @IsOptional()
  @IsString()
  userPhone?: string;

  @ApiPropertyOptional({
    example: 'Particulier',
    description: "Type d'utilisateur: 'Particulier', 'Professionnel', ou 'Entreprise'",
  })
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiPropertyOptional({
    example: 'Andrainjato Fianarantsoa',
    description: "Adresse de l'utilisateur (optionnel).",
  })
  @IsOptional()
  @IsString()
  userAddress?: string;

  // ==================== LOCALISATION ====================
  @ApiPropertyOptional({
    example: -18.927721950160368,
    description: 'Latitude de la localisation principale',
  })
  @IsOptional()
  userMainLat?: number;

  @ApiPropertyOptional({
    example: 47.55809783935547,
    description: 'Longitude de la localisation principale',
  })
  @IsOptional()
  userMainLng?: number;

  // ==================== PROFIL ====================
  @ApiPropertyOptional({
    example: '0rxoxd1x',
    description: 'ID utilisateur personnalisé (optionnel)',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: '2002-10-14',
    description: 'Date de naissance (optionnel)',
  })
  @IsOptional()
  userDateOfBirth?: Date;

  // ==================== DOCUMENTS D'IDENTITÉ ====================
  @ApiPropertyOptional({
    example: '303',
    description: 'Numéro de carte d\'identité (optionnel)',
  })
  @IsOptional()
  @IsString()
  identityCardNumber?: string;

  @ApiPropertyOptional({
    example: 'cin',
    description: "Type de document: 'cin', 'passport', 'rccm'",
  })
  @IsOptional()
  @IsString()
  documentType?: string;

  // ==================== INFORMATIONS PROFESSIONNELLES ====================
  @ApiPropertyOptional({
    example: 'RANDRIAN SARL',
    description: 'Raison sociale (optionnel)',
  })
  @IsOptional()
  @IsString()
  raisonSocial?: string;

  @ApiPropertyOptional({
    example: '12345678901',
    description: 'Numéro NIF (optionnel)',
  })
  @IsOptional()
  @IsString()
  nif?: string;

  @ApiPropertyOptional({
    example: 'MG2024001234',
    description: 'Numéro RCS (optionnel)',
  })
  @IsOptional()
  @IsString()
  rcs?: string;

  @ApiPropertyOptional({
    example: 'Manager',
    description: 'Nom du gérant (optionnel)',
  })
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional({
    example: 'manager@example.com',
    description: 'Email du gérant (optionnel)',
  })
  @IsOptional()
  @IsEmail()
  managerEmail?: string;
}

