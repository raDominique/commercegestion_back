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
import { SiteService } from '../sites/sites.service';
import { NotificationsService } from 'src/shared/notifications/notifications.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { ExportService } from '../../shared/export/export.service';

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
    private readonly socketNotifications: NotificationsService,
    private readonly logger: LoggerService,
    private readonly exportService: ExportService,
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
    const userEmail = dto.userEmail.toLowerCase();
    try {
      // 1. Vérification d'existence rapide (on ne récupère que l'ID)
      const exists = await this.userModel.exists({
        userEmail,
        deletedAt: null,
      });
      if (exists) throw new ConflictException('Email déjà utilisé');

      // Helper pour upload sécurisé
      const safeUpload = async (file: any, folder: string) => {
        const path = await this.uploadService.saveFile(file, folder);
        if (path) uploadedFiles.push(path);
        return path;
      };

      // Uploads individuels
      const avatarPath = files.avatar
        ? await safeUpload(files.avatar, 'avatars')
        : null;
      const logoPath = files.logo
        ? await safeUpload(files.logo, 'logos')
        : null;

      // Uploads multiples (toujours tableau)
      const carteStatPath =
        files.carteStat && Array.isArray(files.carteStat)
          ? await Promise.all(
              files.carteStat.map((stat: any) =>
                safeUpload(stat, 'carteStat').catch((err) => {
                  console.error('Erreur upload carte stat:', err);
                  return null;
                }),
              ),
            )
          : [];

      const carteFiscalPath =
        files.carteFiscal && Array.isArray(files.carteFiscal)
          ? await Promise.all(
              files.carteFiscal.map((fiscal: any) =>
                safeUpload(fiscal, 'carteFiscal').catch((err) => {
                  console.error('Erreur upload carte fiscale:', err);
                  return null;
                }),
              ),
            )
          : [];

      const documentsPaths =
        files.documents && Array.isArray(files.documents)
          ? await Promise.all(
              files.documents.map((doc: any) =>
                safeUpload(doc, 'documents').catch((err) => {
                  console.error('Erreur upload document:', err);
                  return null;
                }),
              ),
            )
          : [];

      // 4. Création de l'utilisateur
      const generateToken = () => randomBytes(32).toString('hex');

      const user = new this.userModel({
        ...dto,
        userEmail,
        userImage: avatarPath,
        logo: logoPath,
        carteStat: carteStatPath,
        carteFiscal: carteFiscalPath,
        identityDocument: documentsPaths,
        userValidated: false,
        userEmailVerified: false,
        parrain1Token: dto.parrain1ID ? generateToken() : null,
        parrain2Token: dto.parrain2ID ? generateToken() : null,
        isParrain1Validated: false,
        isParrain2Validated: false,
      });

      await user.save();

      // 5. Token de vérification
      const verifyToken = generateToken();
      await this.verificationTokenModel.create({
        userId: user._id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // 6. Tâches de fond (Email + Site)
      this.runBackgroundTasks(user, verifyToken).catch((err) =>
        console.error('[BackgroundTasks Error]:', err),
      );

      return {
        status: 'success',
        message: "Demande d'inscription reçue, veuillez vérifier vos mails.",
        data: [user],
      };
    } catch (err) {
      // 7. Cleanup asynchrone en cas d'erreur
      await Promise.all(
        uploadedFiles.map((path) => fs.promises.unlink(path).catch(() => null)),
      );
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

  async validateParrain(
    userId: string,
    parrainId: string,
  ): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (user.userValidated) {
      throw new BadRequestException('Le compte est déjà validé');
    }

    let isMatch = false;

    // Comparaison sécurisée des IDs (ObjectId vs String)
    if (user.parrain1ID?.toString() === parrainId) {
      user.isParrain1Validated = true;
      user.parrain1Token = undefined;
      isMatch = true;
    } else if (user.parrain2ID?.toString() === parrainId) {
      user.isParrain2Validated = true;
      user.parrain2Token = undefined;
      isMatch = true;
    }

    if (!isMatch) {
      throw new BadRequestException(
        'Vous n’êtes pas le parrain de cet utilisateur',
      );
    }

    // Vérification de la validation globale
    const p1Ok = user.parrain1ID ? user.isParrain1Validated : true;
    const p2Ok = user.parrain2ID ? user.isParrain2Validated : true;

    if (p1Ok && p2Ok) {
      user.userValidated = true;
      // On attend la notification avant ou après le save selon votre besoin de consistance
      await this.activateAccountNotify(user);
    }

    await user.save();

    return {
      status: 'success',
      message: 'Parrainage validé',
      data: [user],
    };
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
    filter: any = {},
  ): Promise<PaginationResult<User>> {
    const allowedSortFields = ['createdAt', 'userName', 'userEmail'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const query = this.buildUserQuery(search, filter);

    const skip = (page - 1) * limit;

    const [data, total, totalUserActif, totalAdmin] = await Promise.all([
      this.userModel
        .find(query)
        .select('-userPassword')
        .sort({ [sortField]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.userModel.countDocuments(query),

      this.userModel.countDocuments({
        ...query,
        userValidated: true,
      }),

      this.userModel.countDocuments({
        ...query,
        userAccess: 'Admin',
      }),
    ]);

    return {
      status: 'success',
      message: 'OK',
      data,
      total,
      totalUserActif,
      totalAdmin,
      page,
      limit,
    };
  }

  async findAllByFilsPaginated(
    userIdPartager: string,
    page = 1,
    limit = 10,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    filter: any = {},
  ): Promise<PaginationResult<User>> {
    const allowedSortFields = ['createdAt', 'userName', 'userEmail'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const referralFilter = {
      $or: [{ parrain1ID: userIdPartager }, { parrain2ID: userIdPartager }],
    };

    const query = this.buildUserQuery(search, { ...filter, ...referralFilter });

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-userPassword')
        .sort({ [sortField]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.userModel.countDocuments(query),
    ]);

    return {
      status: 'success',
      message: 'Liste des utilisateurs de vos filleuls',
      data,
      total,
      page,
      limit,
    };
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

  //Supprimer definitivement un utilisateur (Admin)
  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Non trouvé');
    await user.deleteOne();
    return { status: 'success', message: 'Supprimé', data: null };
  }

  async verifyAccountToken(token: string): Promise<string> {
    const buildRedirectUrl = (verified: boolean, reason?: string): string => {
      const params = new URLSearchParams({ verified: String(verified) });
      if (reason) params.set('reason', reason);
      return `${this.frontendUrl}/login?${params.toString()}`;
    };

    if (!token?.trim()) {
      return buildRedirectUrl(false, 'missing_token');
    }

    try {
      const tokenDoc = await this.verificationTokenModel
        .findOne({ token })
        .exec();

      if (!tokenDoc) {
        return buildRedirectUrl(false, 'invalid_token');
      }

      if (tokenDoc.expiresAt < new Date()) {
        await tokenDoc.deleteOne();
        return buildRedirectUrl(false, 'expired_token');
      }

      const result = await this.userModel.updateOne(
        { _id: tokenDoc.userId },
        { userEmailVerified: true },
      );

      if (result.modifiedCount === 0) {
        this.logger.debug(
          'Warning',
          `Utilisateur introuvable pour le token: ${tokenDoc.userId}`,
        );
        return buildRedirectUrl(false, 'user_not_found');
      }

      await tokenDoc.deleteOne();

      const user = await this.userModel.findById(tokenDoc.userId);
      if (!user) {
        return buildRedirectUrl(false, 'user_not_found');
      }

      // ✅ ÉTAPE 1 : Déclarer le tableau de tâches emails
      const emailTasks: Promise<void>[] = [];

      // ✅ Email 1 : Informer l'utilisateur que son email est vérifié, en attente de validation parrain
      emailTasks.push(
        this.mailService
          .notificationCompteAverifier(
            user.userEmail,
            user.userName ?? 'Utilisateur',
          )
          .catch((err) => this.logger.error('Erreur email utilisateur:', err)),
      );

      // ✅ Email 2 : Informer le parrain 1 (si présent et token actif)
      if (user.parrain1ID && user.parrain1Token) {
        const parrain1 = await this.getInfoParrain(user.parrain1ID);
        if (parrain1) {
          emailTasks.push(
            this.mailService
              .sendParrainValidationEmail(
                parrain1.userEmail,
                user.userName ?? 'Nouvel utilisateur',
                `${this.frontendUrl}/login`,
              )
              .catch((err) =>
                this.logger.error('Erreur email parrain 1:', err),
              ),
          );
        }
      }

      // ✅ Email 3 : Informer le parrain 2 (si présent et token actif)
      if (user.parrain2ID && user.parrain2Token) {
        const parrain2 = await this.getInfoParrain(user.parrain2ID);
        if (parrain2) {
          emailTasks.push(
            this.mailService
              .sendParrainValidationEmail(
                parrain2.userEmail,
                user.userName ?? 'Nouvel utilisateur',
                `${this.frontendUrl}/login`,
              )
              .catch((err) =>
                this.logger.error('Erreur email parrain 2:', err),
              ),
          );
        }
      }

      // ✅ ÉTAPE 2 : Exécuter tous les emails en parallèle SANS bloquer la réponse
      // On utilise .catch() pour éviter qu'une erreur n'interrompe le flux principal
      Promise.all(emailTasks).catch((err) =>
        this.logger.error('Erreur globale envoi emails parrainage:', err),
      );

      // ✅ Retourner immédiatement la redirection de succès
      return buildRedirectUrl(true);
    } catch (error: any) {
      this.logger.error('Erreur de vérification du compte:', error);
      return buildRedirectUrl(false, 'server_error');
    }
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
    } catch (e: any) {
      console.error(e.message);
    }
  }

  async getInfoParrain(userId: string): Promise<UserDocument | null> {
    // Utilisation de findOne car l'userId est unique
    return this.userModel.findOne({ userId: userId }).exec();
  }

  private buildUserQuery(search?: string, extraFilter: any = {}) {
    // 1. Extraire et transformer les filtres spécifiques
    const { isActive, isVerified, ...rest } = extraFilter;

    const query: any = {
      deletedAt: null,
      ...rest, // Inclut les autres filtres comme userType
    };

    // Mappage : isActive -> userValidated
    if (isActive !== undefined) {
      query.userValidated = isActive;
    }

    // Mappage : isVerified -> userEmailVerified
    if (isVerified !== undefined) {
      query.userEmailVerified = isVerified;
    }

    // 2. Logique de recherche (Regex)
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { userEmail: regex },
        { userName: regex },
        { userId: regex },
      ];
    }

    return query;
  }

  async exportAll(format: 'excel' | 'pdf', userId?: string): Promise<string> {
    const items = await this.userModel.find().sort({ createdAt: -1 }).lean().exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const subfolder = 'users-export';
    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Email', key: 'userEmail' },
      { header: 'Nom', key: 'userName' },
      { header: 'Type', key: 'userType' },
      { header: 'Téléphone', key: 'userPhone' },
      { header: 'Email vérifié', key: 'userEmailVerified' },
      { header: 'Compte actif', key: 'userValidated' },
      { header: 'Créé le', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(items, columns, 'Utilisateurs', subfolder);
    }
    return this.exportService.exportPDF(
      'Liste des Utilisateurs',
      columns.map(c => c.header),
      items.map(item => columns.map(c => item[c.key] ?? '')),
      subfolder,
    );
  }
}
