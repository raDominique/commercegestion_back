import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @ApiProperty({
    example: 'token_from_email',
    description: 'Token de réinitialisation reçu par email',
  })
  resetToken: string;

  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  @ApiProperty({
    example: 'newPassword123',
    description: 'Nouveau mot de passe',
    minLength: 6,
  })
  newPassword: string;

  @IsString()
  @MinLength(6, {
    message: 'La confirmation doit contenir au moins 6 caractères',
  })
  @ApiProperty({
    example: 'newPassword123',
    description: 'Confirmation du nouveau mot de passe',
    minLength: 6,
  })
  confirmPassword: string;
}
