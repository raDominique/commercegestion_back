import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendTestMailDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  to: string;
}
