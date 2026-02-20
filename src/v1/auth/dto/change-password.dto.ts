import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe actuel doit contenir au moins 6 caractères',
  })
  @ApiProperty({
    example: 'currentPassword123',
    description: 'Mot de passe actuel',
    minLength: 6,
  })
  currentPassword: string;

  @IsString()
  @MinLength(6, {
    message: 'Le nouveau mot de passe doit contenir au moins 6 caractères',
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
