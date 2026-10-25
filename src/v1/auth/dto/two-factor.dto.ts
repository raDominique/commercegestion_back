import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Enable2FADto {}

export class Verify2FADto {
  @ApiProperty({ description: 'Code TOTP à 6 chiffres', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}

export class Disable2FADto {
  @ApiProperty({ description: 'Code TOTP à 6 chiffres', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}
