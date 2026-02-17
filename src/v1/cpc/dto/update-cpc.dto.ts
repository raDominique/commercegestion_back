import { PartialType } from '@nestjs/swagger';
import { CreateCpcDto } from './create-cpc.dto';

export class UpdateCpcDto extends PartialType(CreateCpcDto) {}
