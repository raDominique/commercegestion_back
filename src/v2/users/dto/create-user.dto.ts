import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    example: 'user@example.com',
    description:
      "L'adresse email de l'utilisateur. Doit être unique et valide.",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'strongPassword123',
    description: "Le mot de passe de l'utilisateur. Minimum 8 caractères.",
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'Ma Société',
    description: "Nom de la société de l'utilisateur (optionnel).",
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    example: 'Jean Dupont',
    description: 'Nom de la personne à contacter (optionnel).',
  })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({
    example: '+33123456789',
    description: "Numéro de téléphone de l'utilisateur (optionnel).",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: '123 rue de Paris',
    description: "Adresse de l'utilisateur (optionnel).",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'FR123456789',
    description: "Numéro d'identification fiscale (optionnel).",
  })
  @IsOptional()
  @IsString()
  taxId?: string;
}
