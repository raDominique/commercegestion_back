import { INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';

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

    // --- LOGIQUE AVATAR PAR DÉFAUT ---
    const destFolder = 'users';
    const fileName = 'default-avatar.jpg';
    const publicPath = path.join(process.cwd(), 'upload');
    const folderPath = path.join(publicPath, destFolder);
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/upload/${destFolder}/${fileName}`; // Format identique à votre UploadService

    try {
      // 1. Créer le dossier s'il n'existe pas
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // 2. Télécharger l'avatar si inexistant
      if (!fs.existsSync(filePath)) {
        this.logger.log(
          `Téléchargement de l'avatar par défaut vers ${filePath}...`,
        );
        const fileStream = fs.createWriteStream(filePath);

        // On utilise une image générique pro
        const avatarUrl =
          'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff&size=512';
        //const avatarUrl = `https://source.unsplash.com/512x512/?portrait&random=${randomUUID()}`;

        await new Promise((resolve, reject) => {
          https
            .get(avatarUrl, (response) => {
              response.pipe(fileStream);
              fileStream.on('finish', () => {
                fileStream.close();
                resolve(true);
              });
            })
            .on('error', (err) => {
              fs.unlink(filePath, () => {});
              reject(err);
            });
        });
      }
    } catch (error) {
      this.logger.error(
        "Échec de la préparation de l'avatar du seeder",
        error.message,
      );
    }

    // --- VÉRIFICATION & CRÉATION USER ---
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
      userImage: dbPath,
    });

    await superAdmin.save();
    this.logger.log(`SuperAdmin créé avec succès (${email})`);
  }
}
