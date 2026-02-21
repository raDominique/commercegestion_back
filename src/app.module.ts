import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AppModuleV1 } from './v1/app.module';
import { AppModuleV2 } from './v2/app.module';
import { UsersModule } from './v1/users/users.module';
import { UsersModule as UsersModuleV2 } from './v2/users/users.module';
import { AuthModule } from './v1/auth/auth.module';
import { AuditModule } from './v1/audit/audit.module';
import { MailModule } from './shared/mail/mail.module';
import { SharedModule } from './shared/shared.module';
import { ProductsModule } from './v1/products/products.module';
import { CpcModule } from './v1/cpc/cpc.module';
import { SiteModule } from './v1/sites/sites.module';
import { StockModule } from './v1/stock/stock.module';
import { NotificationsModule } from './shared/notifications/notifications.module';

@Module({
  imports: [
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
        ],
      },
    ]),
    MailModule,
    SharedModule,
  ],
})
export class AppModule {}
