import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Format de courriel invalide' })
  @ApiProperty({
    example: 'superadmin@commercegestion.com',
    description: "Adresse email de l'utilisateur",
  })
  userEmail: string;

  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  @ApiProperty({
    example: 'SuperSecurePassword2026!',
    description: "Mot de passe de l'utilisateur",
    minLength: 6,
  })
  userPassword: string;
}
