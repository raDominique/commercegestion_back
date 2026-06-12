import { PartialType } from '@nestjs/swagger';
import { SubmitBidDto } from './submit-bid.dto';

export class UpdateBidDto extends PartialType(SubmitBidDto) {}
