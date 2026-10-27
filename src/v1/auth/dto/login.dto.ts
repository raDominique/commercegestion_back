import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Format de courriel invalide' })
  @ApiProperty({
    example: 'randrianaivo.dominique@gmail.com',
    description: "Adresse email de l'utilisateur",
  })
  userEmail: string;

  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  @ApiProperty({
    example: '12345678',
    description: "Mot de passe de l'utilisateur",
    minLength: 6,
  })
  userPassword: string;

  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'Le code TOTP doit contenir 6 chiffres' })
  @ApiPropertyOptional({
    example: '123456',
    description: 'Code TOTP à 6 chiffres (si fourni dans le même appel)',
  })
  totpToken?: string;

  @IsOptional()
  @IsString()
  @Length(6, 6, { message: "Le code OTP email doit contenir 6 chiffres" })
  @ApiPropertyOptional({
    example: '123456',
    description: "Code OTP email à 6 chiffres (si fourni dans le même appel)",
  })
  emailOtpToken?: string;
}
