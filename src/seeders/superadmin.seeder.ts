import { INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import {
  User,
  UserDocument,
  UserAccess,
  UserType,
} from 'src/v1/users/users.schema';

import { Seeder } from './seed.interface';

export class SuperAdminSeeder implements Seeder {
  private readonly logger = new Logger(SuperAdminSeeder.name);

  async run(app: INestApplication): Promise<void> {
    const configService = app.get(ConfigService);
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    const email =
      configService.get<string>('SUPERADMIN_EMAIL') ?? 'superadmin@admin.com';

    const password =
      configService.get<string>('SUPERADMIN_PASSWORD') ?? 'SuperAdmin123!';

    const exists = await userModel.findOne({
      userEmail: email.toLowerCase(),
      deletedAt: null,
    });

    if (exists) {
      this.logger.log(`SuperAdmin déjà existant (${email})`);
      return;
    }

    const superAdmin = new userModel({
      userNickName: 'SuperAdmin',
      userName: 'Super',
      userFirstname: 'Admin',
      userEmail: email.toLowerCase(),
      userPassword: password,
      userPhone: '0000000000',
      userType: UserType.PARTICULIER,
      userAccess: UserAccess.ADMIN,
      userId: randomUUID(),
      userValidated: true,
      userEmailVerified: true,
      userTotalSolde: 0,
    });

    await superAdmin.save();

    this.logger.log(`SuperAdmin créé avec succès (${email})`);
  }
}
