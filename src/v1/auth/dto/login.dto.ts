import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
}
