import { MailModule } from 'src/shared/mail/mail.module';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModuleV1 } from './v1/app.module';
import { AppModuleV2 } from './v2/app.module';
import { UsersModule } from './v1/users/users.module';
import { UsersModule as UsersModuleV2 } from './v2/users/users.module';
import { LedgerModule } from './v2/ledger/ledger.module';
import { AuthModule } from './v1/auth/auth.module';
import { AuditModule } from './v1/audit/audit.module';
import { ExportModule } from './shared/export/export.module';
import { ProductsModule } from './v1/products/products.module';
import { CpcModule } from './v1/cpc/cpc.module';
import { SiteModule } from './v1/sites/sites.module';
import { StockModule } from './v1/stock/stock.module';
import { NotificationsModule } from './shared/notifications/notifications.module';
import { ActifsModule } from './v1/actifs/actifs.module';
import { PassifsModule } from './v1/passifs/passifs.module';
import { LedgerDisplayModule } from './v1/ledger-display';
import { TransactionsModule } from './v1/transactions/transactions.module';
import { DashboardModule } from './v1/dashboard/dashboard.module';
import { ShopAvailableModule } from './v1/shop-available/shop-available.module';
import { TenderModule } from './v1/tenders/tender.module';
import { CartModule } from './v1/cart/cart.module';
import { ExchangeModule } from './v1/exchange/exchange.module';

@Module({
  imports: [
    MailModule,
    ExportModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST'),
          port: Number(configService.get<string>('SMTP_PORT')) || 587,
          secure: configService.get<string>('SMTP_SECURE') === 'true',
          auth: {
            user: configService.get<string>('SMTP_USER'),
            pass: configService.get<string>('SMTP_PASS'),
          },
          pool: true,
          maxConnections: 3,
          maxMessages: 50,
          socketTimeout: 10000,
          connectionTimeout: 8000,
        },
        defaults: {
          from: `"${configService.get('SMTP_FROM_NAME')}" <${configService.get('SMTP_FROM')}>`,
        },
        template: {
          dir: join(__dirname, 'shared/mail/templates'),
          adapter: new HandlebarsAdapter(),
          options: { strict: false },
        },
      }),
    }),
    AppModuleV1,
    AppModuleV2,
    RouterModule.register([
      {
        path: 'v1',
        module: AppModuleV1,
        children: [
          { path: 'users', module: UsersModule },
          { path: 'audit', module: AuditModule },
          { path: 'auth', module: AuthModule },
          { path: 'sites', module: SiteModule },
          { path: 'products', module: ProductsModule },
          { path: 'cpc', module: CpcModule },
          { path: 'stocks', module: StockModule },
          { path: 'notifications', module: NotificationsModule },
          { path: 'actifs', module: ActifsModule },
          { path: 'passifs', module: PassifsModule },
          { path: 'transactions', module: TransactionsModule },
          { path: 'ledger', module: LedgerDisplayModule },
          { path: 'dashboard', module: DashboardModule },
          { path: 'shop', module: ShopAvailableModule },
          { path: 'tenders', module: TenderModule },
          { path: 'cart', module: CartModule },
          { path: '', module: MailModule },
          {path: '', module: ExchangeModule},
        ],
      },
      {
        path: 'v2',
        module: AppModuleV2,
        children: [
          {
            path: '',
            module: UsersModuleV2,
          },
          {
            path: 'ledger',
            module: LedgerModule,
          },
        ],
      },
    ]),
  ],
})
export class AppModule {}
