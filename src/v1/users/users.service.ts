import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserAccess, UserDocument, UserType } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { UploadService } from 'src/shared/upload/upload.service';
import { randomUUID, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { MailService } from 'src/shared/mail/mail.service';
import { UserVerificationToken } from './user-verification.schema';
import { ConfigService } from '@nestjs/config';
import { NotifyHelper } from 'src/shared/helpers/notify.helper';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { SiteService } from '../sites/sites.service';
import { NotificationsService } from 'src/shared/notifications/notifications.service';

@Injectable()
export class UsersService {
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

  // ========================= CREATE =========================
  // ========================= CREATE =========================
  async createWithFiles(
    dto: CreateUserDto,
    files: any = {},
  ): Promise<PaginationResult<User>> {
    const uploadedFiles: string[] = [];

    try {
      // 1. Vérification unicité (Email)
      const exists = await this.userModel.findOne({
        userEmail: dto.userEmail.toLowerCase(),
        deletedAt: null,
      });
      if (exists) throw new ConflictException('Email déjà utilisé');

      // 2. Gestion des Uploads (Avatar / Logo)
      const avatarPath = files.avatar
        ? await this.uploadService.saveFile(files.avatar, 'avatars')
        : undefined;
      if (avatarPath) uploadedFiles.push(avatarPath);
      const logoPath = files.logo
        ? await this.uploadService.saveFile(files.logo, 'logos')
        : undefined;
      if (logoPath) uploadedFiles.push(logoPath);

      // 3. Création de l'instance utilisateur
      const user = new this.userModel({
        ...dto,
        userEmail: dto.userEmail.toLowerCase(),
        userId: randomUUID(),
        userImage: avatarPath,
        logo: logoPath,
        userValidated: false,
        userEmailVerified: false,
        userTotalSolde: 0,
      });

      await user.save();

      // --- NOTIFICATIONS & AUDIT ---

      // A. Audit Log & Email standard
      await this.notifyHelper.notify({
        action: AuditAction.CREATE,
        entityType: EntityType.USER,
        entityId: user._id.toString(),
        userId: user._id.toString(),
        newState: user.toObject(),
        emailData: { type: 'CREATE' },
      });

      // B. 🔥 NOTIFICATION SOCKET TEMPS RÉEL AUX ADMINS
      // On prévient tous les admins qu'un compte attend leur validation
      await this.socketNotifications.notifyAllAdmins(
        'Nouvelle inscription à valider',
        `L'utilisateur ${user.userName || user.userEmail} (${user.userType}) vient de s'inscrire et attend votre activation.`,
        { userId: user._id, userType: user.userType },
      );

      // 4. Token de vérification Email & Envoi Mail
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await this.verificationTokenModel.create({
        userId: user._id,
        token,
        expiresAt,
      });
      await this.mailService.verificationAccountUser(
        user.userEmail,
        user.userName ?? user.managerName ?? 'Utilisateur',
        `${this.baseUrl}/api/v1/users/verify?token=${token}`,
      );

      // 5. Création d'un site par défaut (Logic existante)
      const siteDto = {
        siteName: `${user.userName ?? 'Utilisateur'} - Site principal`,
        siteAddress: user.userAddress ?? '',
        siteLat: Number(user.userMainLat) || 0,
        siteLng: Number(user.userMainLng) || 0,
      };
      await this.siteService.create(siteDto, user._id.toString());

      return {
        status: 'success',
        message: `Compte créé. Notification envoyée aux administrateurs pour activation.`,
        data: [user],
      };
    } catch (err) {
      // Nettoyage des fichiers si erreur
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      throw err;
    }
  }

  // ========================= READ (PAGINATED) =========================
  async findAllPaginated(
    page = 1,
    limit = 10,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    filter?: Partial<{
      userType: UserType;
      isActive: boolean;
      isVerified: boolean;
    }>,
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
        { managerName: regex },
      ];
    }

    const p = Number(page);
    const l = Number(limit);
    const skip = (p - 1) * l;

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-userPassword')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(l)
        .exec(),
      this.userModel.countDocuments(query),
    ]);

    return {
      status: 'success',
      message: 'Utilisateurs récupérés',
      data,
      total,
      page: p,
      limit: l,
    };
  }

  // ========================= UPDATE =========================
  async update(
    id: string,
    dto: UpdateUserDto,
    files: any = {},
  ): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const previousState = user.toObject();
    const uploadedFiles: string[] = [];

    try {
      // Gestion Avatar
      if (files.avatar) {
        if (user.userImage && fs.existsSync(user.userImage))
          fs.unlinkSync(user.userImage);
        user.userImage = await this.uploadService.saveFile(
          files.avatar,
          'avatars',
        );
        uploadedFiles.push(user.userImage);
      }

      // Merge des autres champs
      Object.keys(dto).forEach((key) => {
        if (dto[key] !== undefined) user[key] = dto[key];
      });

      const updated = await user.save();

      await this.notifyHelper.notify({
        action: AuditAction.UPDATE,
        entityType: EntityType.USER,
        entityId: updated._id.toString(),
        userId: id, // Ou l'ID de l'admin via le controller
        previousState,
        newState: updated.toObject(),
      });

      return {
        status: 'success',
        message: 'Mise à jour réussie',
        data: [updated],
      };
    } catch (err) {
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      throw err;
    }
  }

  // ========================= UTILS =========================
  async findOne(id: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(id).select('-userPassword');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return { status: 'success', message: 'OK', data: [user] };
  }

  // ========================= VERIFY ACCOUNT TOKEN =========================
  async verifyAccountToken(token: string): Promise<string> {
    const tokenDoc = await this.verificationTokenModel.findOne({ token });

    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      // Optionnel : rediriger vers une page d'erreur spécifique sur le Front
      // return `${this.frontendUrl}/login?error=expired`;
      throw new BadRequestException('Token invalide ou expiré');
    }

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userEmailVerified = true;
    await user.save();
    await tokenDoc.deleteOne();

    // On retourne l'URL complète
    return `${this.frontendUrl}/login?verified=true`;
  }

  // ========================= REMOVE =========================
  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.deletedAt = new Date();
    await user.save();

    await this.notifyHelper.notify({
      action: AuditAction.DELETE,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      userId: id,
      previousState: user.toObject(),
      emailData: { type: 'DELETE' },
    });

    return { status: 'success', message: 'Utilisateur supprimé', data: null };
  }

  // ========================= MÉTHODES REQUISES PAR LES AUTRES SERVICES =========================

  /**
   * Utilisé par NotifyHelper et SiteService (Erreurs lignes 61 et 41)
   */
  async getById(userId: string): Promise<User | null> {
    return this.userModel
      .findOne({
        _id: new Types.ObjectId(userId),
        deletedAt: null,
      })
      .exec();
  }

  /**
   * Utilisé par AuthService pour le Login (Erreur ligne 31)
   * On utilise .select('+userPassword') car le mot de passe est souvent en "select: false"
   */
  async findByEmailWithPassword(
    userEmail: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ userEmail: userEmail.toLowerCase(), deletedAt: null })
      .select('+userPassword')
      .exec();
  }

  // ========================= ACTIVATION PAR ADMIN =========================
  async activateAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userValidated = true;
    await user.save();

    // Notification Socket à l'utilisateur pour lui dire qu'il est activé
    await this.socketNotifications.notifyUser(
      user._id.toString(),
      'Compte Activé !',
      'Votre compte a été validé par un administrateur. Vous pouvez maintenant accéder à tous nos services.',
    );

    return {
      status: 'success',
      message: 'Compte activé avec succès et utilisateur notifié.',
      data: [user],
    };
  }

  /**
   * Méthode utilitaire interne pour vérifier l'existence
   */
  async existsById(userId: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
    });
    return count > 0;
  }

  /**
   * Toggle du rôle entre ADMIN et UTILISATEUR
   * - Si ADMIN => UTILISATEUR
   * - Sinon => ADMIN
   * - SUPERADMIN non modifiable
   */
  async toggleAdminRole(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      _id: userId,
      deletedAt: null,
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const previousRole = user.userAccess;

    // 🔁 Toggle logique
    user.userAccess =
      user.userAccess === UserAccess.ADMIN
        ? UserAccess.UTILISATEUR
        : UserAccess.ADMIN;

    await user.save();

    await this.notifyHelper.notify({
      action: AuditAction.UPDATE,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      userId: user._id.toString(),
      previousState: { userAccess: previousRole },
      newState: { userAccess: user.userAccess },
      emailData: { type: 'UPDATE' },
    });

    return {
      status: 'success',
      message: `Rôle modifié : ${previousRole} ➜ ${user.userAccess}`,
      data: [user],
    };
  }

  /**
   * Trouver un utilisateur par email
   */
  async findByEmail(userEmail: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      userEmail: userEmail.toLowerCase(),
      deletedAt: null,
    });

    if (!user) {
      return { status: 'success', message: 'Utilisateur non trouvé', data: [] };
    }

    return {
      status: 'success',
      message: 'Utilisateur trouvé',
      data: [user],
    };
  }

  /**
   * Trouver un utilisateur par ID avec le mot de passe
   */
  async findByIdWithPassword(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel
      .findOne({
        _id: new Types.ObjectId(userId),
        deletedAt: null,
      })
      .select('+userPassword');

    if (!user) {
      return { status: 'success', message: 'Utilisateur non trouvé', data: [] };
    }

    return {
      status: 'success',
      message: 'Utilisateur trouvé',
      data: [user],
    };
  }

  /**
   * Trouver un utilisateur par token de réinitialisation
   */
  async findByResetToken(resetToken: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({
      resetPasswordToken: resetToken,
      deletedAt: null,
    });

    if (!user) {
      return { status: 'success', message: 'Utilisateur non trouvé', data: [] };
    }

    return {
      status: 'success',
      message: 'Utilisateur trouvé',
      data: [user],
    };
  }

  /**
   * Mettre à jour le token de réinitialisation du mot de passe
   */
  async updatePasswordReset(
    userId: string,
    resetToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        resetPasswordToken: resetToken,
        resetPasswordExpires: expiresAt,
      },
    );
  }

  /**
   * Mettre à jour le mot de passe
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { userPassword: newPassword },
    );
  }

  /**
   * Nettoyer les tokens de réinitialisation
   */
  async clearPasswordReset(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    );
  }
}
