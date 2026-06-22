import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActifsModule } from '../actifs/actifs.module';
import { PassifsModule } from '../passifs/passifs.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../../shared/mail/mail.module';
import { ExchangeController } from './exchange.controller';
import { ExchangeOffer, ExchangeOfferSchema } from './exchange.schema';
import { ExchangeService } from './exchange.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExchangeOffer.name, schema: ExchangeOfferSchema },
    ]),
    ActifsModule,
    PassifsModule,
    UsersModule,
    ProductsModule,
    MailModule,
  ],
  controllers: [ExchangeController],
  providers: [ExchangeService],
})
export class ExchangeModule {}
