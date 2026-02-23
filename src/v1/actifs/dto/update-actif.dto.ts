import { PartialType } from '@nestjs/swagger';
import { CreateActifDto } from './create-actif.dto';

export class UpdateActifDto extends PartialType(CreateActifDto) {}
