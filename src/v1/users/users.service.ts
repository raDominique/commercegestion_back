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
import { User, UserAccess, UserDocument } from './users.schema';
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
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
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

  /**
   * Migration : Convertit les anciens IDs qui ne font pas 8 caractères
   */
  private async migrateExistingUsers() {
    // Utilisation d'une Regex pour trouver les IDs qui n'ont PAS exactement 8 caractères
    // Cela évite les erreurs de type complexes avec $where ou $expr
    const usersToMigrate = await this.userModel
      .find({
        $or: [
          { userId: { $exists: false } },
          { userId: null },
          { userId: { $not: /^[A-Z0-9]{8}$/ } }, // Tout ce qui n'est pas 8 caractères Alphanumériques
        ],
      })
      .exec();

    if (usersToMigrate.length > 0) {
      console.log(
        `[Migration] Mise à jour de ${usersToMigrate.length} utilisateurs...`,
      );
      for (const user of usersToMigrate) {
        // En forçant la sauvegarde, le middleware .pre('save') du schéma générera le nouvel ID
        await user.save();
      }
      console.log(`[Migration] Terminée.`);
    }
  }

  // ========================= CREATE =========================
  async createWithFiles(
    dto: CreateUserDto,
    files: {
      avatar?: any;
      logo?: any;
      documents?: any[];
      carteStat?: any[];
      carteFiscal?: any[];
    } = {},
  ): Promise<PaginationResult<User>> {
    const uploadedFiles: string[] = [];

    try {
      // 1. Vérification d'existence
      const exists = await this.userModel.findOne({
        userEmail: dto.userEmail.toLowerCase(),
        deletedAt: null,
      });
      if (exists) throw new ConflictException('Email déjà utilisé');

      // 2. Gestion des Uploads (Simples et Tableaux)
      // Fonction helper pour uploader et tracker
      const safeUpload = async (file: any, folder: string) => {
        const path = await this.uploadService.saveFile(file, folder);
        if (path) uploadedFiles.push(path);
        return path;
      };

      const safeUploadMany = async (filesArray: any[], folder: string) => {
        if (!filesArray || !filesArray.length) return [];
        return Promise.all(filesArray.map((f) => safeUpload(f, folder)));
      };

      // Dans votre bloc Promise.all du service :

      const [avatarPath, logoPath, docPaths, statPaths, fiscalPaths] =
        await Promise.all([
          files.avatar ? safeUpload(files.avatar, 'avatars') : null,
          files.logo ? safeUpload(files.logo, 'logos') : null,
          safeUploadMany(files.documents ?? [], 'documents'),
          safeUploadMany(files.carteStat ?? [], 'statistiques'),
          safeUploadMany(files.carteFiscal ?? [], 'fiscalite'),
        ]);

      // 3. Création de l'utilisateur
      const user = new this.userModel({
        ...dto,
        userEmail: dto.userEmail.toLowerCase(),
        userImage: avatarPath,
        logo: logoPath,
        identityDocument: docPaths,
        carteStat: statPaths,
        carteFiscal: fiscalPaths,
        userValidated: false,
        userEmailVerified: false,
        userTotalSolde: 0,
      });

      await user.save();

      // 4. Token de vérification
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await this.verificationTokenModel.create({
        userId: user._id,
        token,
        expiresAt,
      });

      // 5. Tâches de fond (Email, etc.)
      this.runBackgroundTasks(user, token).catch((err) => {
        console.error(`[Background Error]:`, err.message);
      });

      return {
        status: 'success',
        message: `Compte créé. Votre code parrainage est ${user.userId}`,
        data: [user],
      };
    } catch (err) {
      // Nettoyage en cas d'échec
      for (const f of uploadedFiles) {
        try {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } catch (e) {
          console.error(`Erreur lors de la suppression de ${f}`, e);
        }
      }
      throw err;
    }
  }

  private async runBackgroundTasks(user: UserDocument, token: string) {
    try {
      await Promise.all([
        this.notifyHelper.notify({
          action: AuditAction.CREATE,
          entityType: EntityType.USER,
          entityId: user._id.toString(),
          userId: user._id.toString(),
          newState: user.toObject(),
          emailData: { type: 'CREATE' },
        }),
        this.socketNotifications.notifyAllAdmins(
          'Nouvelle inscription',
          `L'utilisateur ${user.userEmail} attend validation.`,
          { userId: user._id },
        ),
        this.mailService.verificationAccountUser(
          user.userEmail,
          user.userName ?? 'Utilisateur',
          `${this.baseUrl}/api/v1/users/verify?token=${token}`,
        ),
        this.createDefaultSite(user),
      ]);
    } catch (err) {
      console.error(`[Background Tasks Error]:`, err);
    }
  }

  private async createDefaultSite(user: any) {
    try {
      const siteDto = {
        siteName: `${user.userName ?? 'Utilisateur'} - Site principal`,
        siteAddress: user.userAddress ?? '',
        siteLat: Number(user['userMainLat']) || 0,
        siteLng: Number(user['userMainLng']) || 0,
      };
      await this.siteService.create(siteDto, user._id.toString());
    } catch (err) {
      console.error(`[Default Site Creation Error]:`, err.message);
    }
  }

  // ========================= AUTRES MÉTHODES =========================

  // ========================= READ (Correction Arguments) =========================
  async findAllPaginated(
    page = 1,
    limit = 10,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    filter?: any,
  ): Promise<PaginationResult<User>> {
    const query: any = { deletedAt: null };

    if (filter?.userType) query.userType = filter.userType;
    if (typeof filter?.isActive === 'boolean')
      query.userValidated = filter.isActive;
    if (typeof filter?.isVerified === 'boolean')
      query.userEmailVerified = filter.isVerified;

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { userEmail: regex },
        { userName: regex },
        { userId: regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-userPassword')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.userModel.countDocuments(query),
    ]);

    return {
      status: 'success',
      message: 'OK',
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
  async findOne(id: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(id).select('-userPassword');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return { status: 'success', message: 'Utilisateur récupéré', data: [user] };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    files: any = {},
  ): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const previousState = user.toObject();
    if (files.avatar) {
      if (user.userImage && fs.existsSync(user.userImage))
        fs.unlinkSync(user.userImage);
      user.userImage = await this.uploadService.saveFile(
        files.avatar,
        'avatars',
      );
    }

    Object.keys(dto).forEach((key) => {
      if (dto[key] !== undefined) (user as any)[key] = dto[key];
    });

    const updated = await user.save();
    return {
      status: 'success',
      message: 'Utilisateur mis à jour',
      data: [updated],
    };
  }

  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    user.deletedAt = new Date();
    await user.save();
    return { status: 'success', message: 'Utilisateur supprimé', data: null };
  }

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
      .select('+userPassword') // Inclut le champ password qui est en "select: false"
      .exec();
  }

  async findByEmail(userEmail: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      userEmail: userEmail,
      deletedAt: null,
    });
    return {
      status: 'success',
      message: 'Utilisateur récupéré',
      data: user ? [user] : [],
    };
  }

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

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (user) {
      user.userPassword = newPassword;
      await user.save();
    }
  }

  async clearPasswordReset(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { resetPasswordToken: null, resetPasswordExpires: null },
    );
  }

  /**
   * Alterne le rôle d'un utilisateur entre ADMIN et UTILISATEUR
   */
  async toggleAdminRole(userId: string): Promise<PaginationResult<User>> {
    // 1. Recherche de l'utilisateur
    const user = await this.userModel.findOne({
      _id: userId,
      deletedAt: null,
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const previousRole = user.userAccess;

    // 2. Logique de bascule (Toggle)
    // On utilise un cast 'as any' si les enums causent des soucis de typage strict
    const newRole =
      user.userAccess === UserAccess.ADMIN
        ? UserAccess.UTILISATEUR
        : UserAccess.ADMIN;

    user.userAccess = newRole;

    // 3. Sauvegarde (déclenche le middleware si nécessaire, mais ici userId ne changera pas car length === 8)
    await user.save();

    // 4. Audit et Notifications
    try {
      await this.notifyHelper.notify({
        action: AuditAction.UPDATE,
        entityType: EntityType.USER,
        entityId: user._id.toString(),
        userId: user._id.toString(), // ID de l'exécuteur
        previousState: { userAccess: previousRole },
        newState: { userAccess: user.userAccess },
        emailData: { type: 'UPDATE' },
      });

      // Notification en temps réel via Socket
      await this.socketNotifications.notifyUser(
        user._id.toString(),
        'Mise à jour de vos accès',
        `Votre rôle a été modifié en : ${user.userAccess}`,
      );
    } catch (error) {
      console.error(`[ToggleAdminRole Notification Error]:`, error.message);
    }

    return {
      status: 'success',
      message: `Rôle modifié : ${previousRole} ➜ ${user.userAccess}`,
      data: [user],
    };
  }

  // ========================= VERIFICATION & ACTIVATION (Méthodes manquantes) =========================

  async verifyAccountToken(token: string): Promise<string> {
    const tokenDoc = await this.verificationTokenModel.findOne({ token });
    if (!tokenDoc || tokenDoc.expiresAt < new Date())
      throw new BadRequestException('Token invalide ou expiré');

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userEmailVerified = true;
    await user.save();
    await tokenDoc.deleteOne();

    return `${this.frontendUrl}/login?verified=true`;
  }

  async activateAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userValidated = true;
    await user.save();

    await this.socketNotifications.notifyUser(
      user._id.toString(),
      'Compte Activé',
      'Votre compte a été validé.',
    );
    return { status: 'success', message: 'Compte activé', data: [user] };
  }

  async getById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async findByIdWithPassword(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel
      .findOne({
        _id: new Types.ObjectId(userId),
        deletedAt: null,
      })
      .select('+userPassword')
      .exec();

    return {
      status: 'success',
      message: user ? 'Utilisateur trouvé' : 'Utilisateur non trouvé',
      data: user ? [user] : [],
    };
  }

  /**
   * Recherche un utilisateur par son token de réinitialisation de mot de passe.
   * Utilisé lors de la phase finale de "Mot de passe oublié".
   */
  async findByResetToken(resetToken: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() },
      deletedAt: null,
    });

    return {
      status: 'success',
      message: user
        ? 'Utilisateur trouvé'
        : 'Lien de réinitialisation invalide ou expiré',
      data: user ? [user] : [],
    };
  }

  async findAllNoPaginated(): Promise<PaginationResult<any>> {
    try {
      const users = await this.userModel
        .find({ deletedAt: null, userValidated: true, userEmailVerified: true })
        .select('_id userName userFirstname userId')
        .lean()
        .exec();

      const mapped = users.map((u) => ({
        _id: u._id,
        name: [u.userName, u.userFirstname].filter(Boolean).join(' '),
        userId: u.userId,
      }));

      return {
        status: 'success',
        message: 'Utilisateurs récupérés',
        data: mapped,
      };
    } catch (error) {
      throw new BadRequestException(
        'Erreur lors de la récupération des utilisateurs',
      );
    }
  }
}
