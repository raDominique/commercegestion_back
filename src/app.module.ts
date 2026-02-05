import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { AppModuleV1 } from './v1/app.module';
import { AppModuleV2 } from './v2/app.module';
import { UsersModule } from './v1/users/users.module';
import { UsersModule as UsersModuleV2 } from './v2/users/users.module';

@Module({
    imports: [
        AppModuleV1,
        AppModuleV2,
        RouterModule.register([
            {
                path: 'v1',
                module: AppModuleV1,
                children: [
                    {
                        path: '',
                        module: UsersModule,
                    },
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
    ],
})
export class AppModule {}