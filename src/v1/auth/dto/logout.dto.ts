import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LogoutDto {
  @IsString()
  @ApiProperty({
    example: 'refresh-token-string-here',
    description: 'Le refresh token obtenu lors du login',
  })
  refreshToken: string;
}
