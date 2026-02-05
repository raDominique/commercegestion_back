import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Format de courriel invalide' })
  @ApiProperty({
    example: 'utilisateur@exemple.com',
    description: 'Adresse e-mail de l\'utilisateur',
  })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  @ApiProperty({
    example: 'motDePasseFort123',
    description: 'Mot de passe de l\'utilisateur',
    minLength: 6,
  })
  password: string;
}
