import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Format de courriel invalide' })
  @ApiProperty({
    example: 'user@example.com',
    description: "Adresse email de l'utilisateur",
  })
  userEmail: string;
}
