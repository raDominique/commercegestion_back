import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { UploadService } from 'src/shared/upload/upload.service';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { MailService } from 'src/shared/mail/mail.service';
import { UserVerificationToken } from './user-verification.schema';
import { ConfigService } from '@nestjs/config';
import { NotifyHelper } from 'src/shared/helpers/notify.helper';
import { SiteService } from '../sites/sites.service';
import { NotificationsService } from 'src/shared/notifications/notifications.service';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly frontendUrl: string;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserVerificationToken.name)
    private readonly verificationTokenModel: Model<UserVerificationToken>,
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => SiteService))
    private readonly siteService: SiteService,
    private readonly notifyHelper: NotifyHelper,
    private readonly socketNotifications: NotificationsService,
  ) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
  }

  async onModuleInit() {
    await this.migrateExistingUsers();
  }

  // ========================= MIGRATION =========================
  private async migrateExistingUsers() {
    const usersToMigrate = await this.userModel
      .find({
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: { $not: /^[A-Z0-9]{8}$/ } },
        ],
      })
      .exec();

    if (usersToMigrate.length > 0) {
      for (const user of usersToMigrate) {
        await user.save();
      }
    }
  }

  // ========================= CREATE & PARRAINAGE =========================
  async createWithFiles(
    dto: CreateUserDto,
    files: any = {},
  ): Promise<PaginationResult<User>> {
    const uploadedFiles: string[] = [];

    try {
      const exists = await this.userModel.findOne({
        userEmail: dto.userEmail.toLowerCase(),
        deletedAt: null,
      });
      if (exists) throw new ConflictException('Email déjà utilisé');

      // Uploads
      const safeUpload = async (file: any, folder: string) => {
        const path = await this.uploadService.saveFile(file, folder);
        if (path) uploadedFiles.push(path);
        return path;
      };

      const [avatarPath, logoPath] = await Promise.all([
        files.avatar ? safeUpload(files.avatar, 'avatars') : null,
        files.logo ? safeUpload(files.logo, 'logos') : null,
      ]);

      // Création de l'utilisateur avec tokens de parrainage
      const user = new this.userModel({
        ...dto,
        userEmail: dto.userEmail.toLowerCase(),
        userImage: avatarPath,
        logo: logoPath,
        userValidated: false,
        userEmailVerified: false,
        parrain1Token: dto.parrain1ID ? randomBytes(32).toString('hex') : null,
        parrain2Token: dto.parrain2ID ? randomBytes(32).toString('hex') : null,
        isParrain1Validated: false,
        isParrain2Validated: false,
      });

      await user.save();

      // Token de vérification email (standard)
      const verifyToken = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await this.verificationTokenModel.create({
        userId: user._id,
        token: verifyToken,
        expiresAt,
      });

      // Tâches de fond
      this.runBackgroundTasks(user, verifyToken).catch((err) =>
        console.error(err),
      );

      return {
        status: 'success',
        message: "Demande d'inscription reçue, veuillez vérifier vos mails.",
        data: [user],
      };
    } catch (err) {
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      throw err;
    }
  }

  private async runBackgroundTasks(user: UserDocument, token: string) {
    try {
      const tasks: Promise<any>[] = [
        this.mailService.verificationAccountUser(
          user.userEmail,
          user.userName ?? 'Utilisateur',
          `${this.baseUrl}/api/v1/users/verify?token=${token}`,
        ),
        this.createDefaultSite(user),
      ];

      // Envoi des emails aux parrains
      if (user.parrain1ID && user.parrain1Token) {
        const p1 = await this.getInfoParrain(user.parrain1ID);
        if (p1) {
          tasks.push(
            this.mailService.sendParrainValidationEmail(
              p1.userEmail,
              user.userName,
              `${this.baseUrl}/api/v1/users/validate-parrain?token=${user.parrain1Token}`,
            ),
          );
        }
      }

      if (user.parrain2ID && user.parrain2Token) {
        const p2 = await this.getInfoParrain(user.parrain2ID);
        if (p2) {
          tasks.push(
            this.mailService.sendParrainValidationEmail(
              p2.userEmail,
              user.userName,
              `${this.baseUrl}/api/v1/users/validate-parrain?token=${user.parrain2Token}`,
            ),
          );
        }
      }

      await Promise.all(tasks);
    } catch (err) {
      console.error(`[Background Tasks Error]:`, err);
    }
  }

  // ========================= LOGIQUE DE VALIDATION PARRAIN =========================

  async validateByParrainToken(token: string): Promise<string> {
    const user = await this.userModel.findOne({
      $or: [{ parrain1Token: token }, { parrain2Token: token }],
      deletedAt: null,
    });

    if (!user)
      throw new BadRequestException(
        'Lien de validation invalide ou déjà utilisé.',
      );

    // Identifier quel parrain valide
    if (user.parrain1Token === token) {
      user.isParrain1Validated = true;
      user.parrain1Token = undefined; // On invalide le token
    } else if (user.parrain2Token === token) {
      user.isParrain2Validated = true;
      user.parrain2Token = undefined;
    }

    // Vérification finale : si les parrains requis ont tous validé
    const p1Required = !!user.parrain1ID;
    const p2Required = !!user.parrain2ID;

    const p1Ok = p1Required ? user.isParrain1Validated : true;
    const p2Ok = p2Required ? user.isParrain2Validated : true;

    if (p1Ok && p2Ok) {
      user.userValidated = true;
      await this.activateAccountNotify(user);
    }

    await user.save();
    return `${this.frontendUrl}/login?status=validated`;
  }

  private async activateAccountNotify(user: UserDocument) {
    await Promise.all([
      this.socketNotifications.notifyUser(
        user._id.toString(),
        'Compte Activé',
        'Validé par vos parrains.',
      ),
      this.mailService.notificationAccountUserActive(
        user.userEmail,
        user.userName,
        `${this.frontendUrl}/login`,
      ),
    ]);
  }

  // ========================= CRUD & UTILS =========================

  async findAllPaginated(
    page = 1,
    limit = 10,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    filter?: any,
  ): Promise<PaginationResult<User>> {
    const query: any = { deletedAt: null };
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { userEmail: regex },
        { userName: regex },
        { userId: regex },
      ];
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-userPassword')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(query),
    ]);
    return { status: 'success', message: 'OK', data, total, page, limit };
  }

  async findOne(id: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(id).select('-userPassword');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return { status: 'success', message: 'OK', data: [user] };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    files: any = {},
  ): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('Non trouvé');
    if (files.avatar) {
      user.userImage = await this.uploadService.saveFile(
        files.avatar,
        'avatars',
      );
    }
    Object.assign(user, dto);
    const updated = await user.save();
    return { status: 'success', message: 'Mis à jour', data: [updated] };
  }

  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Non trouvé');
    user.deletedAt = new Date();
    await user.save();
    return { status: 'success', message: 'Supprimé', data: null };
  }

  async verifyAccountToken(token: string): Promise<string> {
    const tokenDoc = await this.verificationTokenModel.findOne({ token });
    if (!tokenDoc || tokenDoc.expiresAt < new Date())
      throw new BadRequestException('Token invalide');
    await this.userModel.updateOne(
      { _id: tokenDoc.userId },
      { userEmailVerified: true },
    );
    await tokenDoc.deleteOne();
    return `${this.frontendUrl}/login?verified=true`;
  }

  /**
   * Active manuellement un compte (Admin)
   */
  async activateAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userValidated = true;
    // On valide aussi les parrains par défaut si l'admin force l'activation
    user.isParrain1Validated = true;
    user.isParrain2Validated = true;

    await user.save();
    await this.activateAccountNotify(user);

    return {
      status: 'success',
      message: "Compte activé par l'admin",
      data: [user],
    };
  }

  /**
   * Alterne le rôle entre ADMIN et UTILISATEUR
   */
  async toggleAdminRole(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userAccess = user.userAccess === 'Admin' ? 'Utilisateur' : 'Admin';
    await user.save();

    return {
      status: 'success',
      message: `Rôle modifié : ${user.userAccess}`,
      data: [user],
    };
  }

  /**
   * Liste simple pour les sélections (sans pagination)
   */
  async findAllNoPaginated(): Promise<PaginationResult<any>> {
    const users = await this.userModel
      .find({ deletedAt: null, userValidated: true })
      .select('_id userName userFirstname userId')
      .lean();

    const data = users.map((u) => ({
      _id: u._id,
      name: `${u.userName} ${u.userFirstname}`,
      userId: u.userId,
    }));

    return { status: 'success', message: 'OK', data };
  }

  /**
   * Recherche un utilisateur par email (ou email manager)
   * en incluant explicitement le mot de passe pour la vérification (Login)
   */
  async findByEmailWithPassword(
    userEmail: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({
        $or: [
          { userEmail: userEmail.toLowerCase() },
          { managerEmail: userEmail.toLowerCase() },
        ],
        deletedAt: null,
      })
      .select('+userPassword')
      .exec();
  }

  // ========================= MÉTHODES REQUISES PAR AUTH / HELPERS =========================

  /**
   * Utilisé par NotifyHelper et SitesService
   */
  async getById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(id),
      deletedAt: null,
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  /**
   * Utilisé par AuthService (Forgot Password)
   */
  async findByEmail(userEmail: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      userEmail: userEmail.toLowerCase(),
      deletedAt: null,
    });
    return {
      status: 'success',
      message: 'Utilisateur récupéré',
      data: user ? [user] : [],
    };
  }

  /**
   * Utilisé par AuthService pour stocker le token de réinitialisation
   */
  async updatePasswordReset(
    userId: string,
    resetToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { resetPasswordToken: resetToken, resetPasswordExpires: expiresAt },
    );
  }

  /**
   * Utilisé par AuthService pour trouver l'utilisateur via le token de reset
   */
  async findByResetToken(resetToken: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() },
      deletedAt: null,
    });

    return {
      status: 'success',
      message: user ? 'Utilisateur trouvé' : 'Lien invalide ou expiré',
      data: user ? [user] : [],
    };
  }

  /**
   * Mise à jour globale du mot de passe (Hashé via le middleware .pre('save'))
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (user) {
      user.userPassword = newPassword;
      await user.save();
    }
  }

  /**
   * Nettoyage après réinitialisation
   */
  async clearPasswordReset(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { resetPasswordToken: null, resetPasswordExpires: null },
    );
  }

  /**
   * Utilisé par AuthService pour vérifier l'ancien mot de passe
   */
  async findByIdWithPassword(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel
      .findOne({ _id: new Types.ObjectId(userId), deletedAt: null })
      .select('+userPassword')
      .exec();

    return {
      status: 'success',
      message: user ? 'Utilisateur trouvé' : 'Utilisateur non trouvé',
      data: user ? [user] : [],
    };
  }

  private async createDefaultSite(user: any) {
    try {
      const siteDto = {
        siteName: `${user.userName} - Site principal`,
        siteAddress: user.userAddress || '',
        siteLat: Number(user.userMainLat) || 0,
        siteLng: Number(user.userMainLng) || 0,
      };
      await this.siteService.create(siteDto, user._id.toString(), true);
    } catch (e) {
      console.error(e.message);
    }
  }

async getInfoParrain(userId: string): Promise<UserDocument | null> {
  // Utilisation de findOne car l'userId est unique
  return this.userModel.findOne({ userId: userId }).exec();
}
}
