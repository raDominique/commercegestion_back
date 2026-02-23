import { PartialType } from '@nestjs/swagger';
import { CreatePassifDto } from './create-passif.dto';

export class UpdatePassifDto extends PartialType(CreatePassifDto) {}
