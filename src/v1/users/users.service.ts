import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Error as MongooseError } from 'mongoose';
import { User, UserDocument, UserType } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { UploadService } from 'src/shared/upload/upload.service';
import { randomUUID, randomBytes } from 'crypto';
import { validateDocumentMime } from './users.helper';
import * as fs from 'fs';
import { MailService } from 'src/shared/mail/mail.service';
import { UserVerificationToken } from './user-verification.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly context = 'UsersService';
  private readonly baseUrl: string;
  private readonly adminEmail: string;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(UserVerificationToken.name)
    private readonly verificationTokenModel: Model<UserVerificationToken>,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly uploadService: UploadService,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly mailService: MailService,
  ) {
    this.baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
    this.adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') ||
      'admin@example.com';
  }

  // ========================= CREATE USER WITH FILES & MAIL =========================
  async createWithFiles(
    dto: CreateUserDto,
    files: {
      avatar?: Express.Multer.File;
      logo?: Express.Multer.File;
      carteStat?: Express.Multer.File;
      documents?: Express.Multer.File[];
      carteFiscal?: Express.Multer.File[];
    },
  ): Promise<User> {
    const session = await this.connection.startSession();
    const uploadedFiles: string[] = [];

    try {
      session.startTransaction();

      // ---------------- Email unique ----------------
      const exists = await this.userModel.findOne(
        { userEmail: dto.userEmail.toLowerCase(), deletedAt: null },
        null,
        { session },
      );
      if (exists) throw new ConflictException('Email déjà utilisé');

      // ---------------- Validation entreprise ----------------
      if (dto.userType === 'Entreprise') {
        if (!dto.managerName || !dto.managerEmail)
          throw new BadRequestException(
            'managerName et managerEmail obligatoires pour les entreprises',
          );
      }

      // ---------------- Validation MIME ----------------
      if (files.documents?.length)
        validateDocumentMime(files.documents, dto.documentType);
      if (files.carteFiscal?.length)
        validateDocumentMime(files.carteFiscal, 'carte-fiscale');

      // ---------------- Upload fichiers ----------------
      const avatarPath = files.avatar
        ? await this.uploadService.saveFile(files.avatar, 'avatars')
        : undefined;
      if (avatarPath) uploadedFiles.push(avatarPath);

      const logoPath = files.logo
        ? await this.uploadService.saveFile(files.logo, 'logos')
        : undefined;
      if (logoPath) uploadedFiles.push(logoPath);

      const carteStatPath = files.carteStat
        ? await this.uploadService.saveFile(files.carteStat, 'carteStat')
        : undefined;
      if (carteStatPath) uploadedFiles.push(carteStatPath);

      const documentPaths: string[] = [];
      for (const doc of files.documents ?? []) {
        const p = await this.uploadService.saveFile(doc, 'documents');
        uploadedFiles.push(p);
        documentPaths.push(p);
      }

      const carteFiscalPaths: string[] = [];
      for (const cf of files.carteFiscal ?? []) {
        const p = await this.uploadService.saveFile(cf, 'carteFiscal');
        uploadedFiles.push(p);
        carteFiscalPaths.push(p);
      }

      // ---------------- Création user ----------------
      const user = new this.userModel({
        ...dto,
        userEmail: dto.userEmail.toLowerCase(),
        userType: dto.userType ?? 'Particulier',
        userAccess: 'Utilisateur',
        userImage: avatarPath,
        userId: randomUUID(),
        identityDocument: documentPaths,
        logo: logoPath,
        carteStat: carteStatPath,
        carteFiscal: carteFiscalPaths,
        userValidated: false,
        userEmailVerified: false,
        userTotalSolde: 0,
      });

      await user.save({ session });

      // ---------------- Commit transaction ----------------
      await session.commitTransaction();
      await session.endSession();

      this.logger.log(this.context, `✅ Utilisateur créé: ${user.userEmail}`);

      // ---------------- Génération token sécurisé ----------------
      const token = randomBytes(32).toString('hex'); // 64 caractères
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24h

      await this.verificationTokenModel.create({
        userId: user._id,
        token,
        expiresAt,
      });

      const verificationLink = `${this.baseUrl}/api/v1/users/verify?token=${token}`;

      // ---------------- 📧 EMAIL 1: Vérification du compte (utilisateur) ----------------
      try {
        await this.mailService.verificationAccountUser(
          user.userEmail,
          user.userName ?? user.managerName ?? 'Utilisateur',
          verificationLink,
        );
        this.logger.log(this.context, `📧 Email de vérification envoyé à ${user.userEmail}`);
      } catch (mailError) {
        this.logger.error(
          this.context,
          `⚠️ Erreur envoi email de vérification à ${user.userEmail}`,
          mailError.stack,
        );
        // On ne bloque pas l'inscription si l'email échoue
      }

      // ---------------- 📧 EMAIL 2: Notification admin nouveau user ----------------
      try {
        await this.mailService.notificationAdminNouveauUser(
          this.adminEmail,
          user.userName ?? user.managerName ?? 'Utilisateur',
          user.userEmail,
          user.userId,
          user.userType,
          user.createdAt,
          // ipAddress peut être passé via le DTO si nécessaire
        );
        this.logger.log(this.context, `📧 Notification admin envoyée pour ${user.userEmail}`);
      } catch (mailError) {
        this.logger.error(
          this.context,
          `⚠️ Erreur envoi notification admin`,
          mailError.stack,
        );
        // On ne bloque pas l'inscription
      }

      return user;
    } catch (err) {
      // ---------------- Rollback transaction si non commit ----------------
      try {
        await session.abortTransaction();
      } catch (e) {
        // si commit déjà fait, ignorer
      } finally {
        session.endSession();
      }

      // ---------------- Rollback fichiers uploadés ----------------
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }

      this.logger.error(
        this.context,
        'Erreur création utilisateur',
        err.stack,
      );

      throw err instanceof BadRequestException ||
        err instanceof ConflictException
        ? err
        : new InternalServerErrorException(
            err.message || 'Création utilisateur échouée',
          );
    }
  }

  // ========================= Vérification sécurisée du compte =========================
  async verifyAccountToken(token: string): Promise<PaginationResult<User>> {
    const tokenDoc = await this.verificationTokenModel.findOne({ token });
    if (!tokenDoc) throw new BadRequestException('Token invalide ou expiré');

    if (tokenDoc.expiresAt < new Date())
      throw new BadRequestException('Token expiré');

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (user.userEmailVerified)
      throw new BadRequestException('Compte déjà vérifié');

    user.userEmailVerified = true;
    await user.save();

    // Supprimer le token après utilisation
    await tokenDoc.deleteOne();

    this.logger.log(this.context, `✅ Email vérifié pour ${user.userEmail}`);

    // ---------------- 📧 EMAIL 3: Compte en attente de vérification admin (utilisateur) ----------------
    try {
      await this.mailService.notificationCompteAverifier(
        user.userEmail,
        user.userName ?? user.managerName ?? 'Utilisateur',
      );
      this.logger.log(this.context, `📧 Email "compte en attente" envoyé à ${user.userEmail}`);
    } catch (mailError) {
      this.logger.error(
        this.context,
        `⚠️ Erreur envoi email "compte en attente"`,
        mailError.stack,
      );
      // On ne bloque pas la vérification
    }

    return {
      status: 'success',
      message: 'Compte vérifié avec succès. En attente de validation par un administrateur.',
      data: [user],
    };
  }

  // ========================= FIND ONE =========================
  async findOne(id: string): Promise<PaginationResult<User>> {
    try {
      const user = await this.userModel
        .findOne({ _id: id, deletedAt: null })
        .select('-password')
        .exec();

      if (!user) throw new NotFoundException('User not found');

      return {
        status: 'success',
        message: 'User fetched successfully',
        data: [user],
      };
    } catch (error) {
      if (error instanceof MongooseError.CastError)
        throw new BadRequestException('Invalid user id');
      throw error;
    }
  }

  // ========================= FIND ALL =========================
  async findAll(): Promise<PaginationResult<User>> {
    try {
      const users = await this.userModel
        .find({ deletedAt: null })
        .select('-password')
        .exec();
      return {
        status: 'success',
        message: 'Users fetched successfully',
        data: users,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  // ========================= FIND BY EMAIL WITH PASSWORD (FOR AUTH) =========================
  /**
   * Recherche un utilisateur par email ET inclut le mot de passe
   * Utilisé uniquement pour l'authentification
   */
  async findByEmailWithPassword(userEmail: string): Promise<User | null> {
    try {
      const user = await this.userModel
        .findOne({ userEmail: userEmail.toLowerCase(), deletedAt: null })
        .select('+userPassword') // Inclure le mot de passe
        .exec();

      if (user) {
        this.logger.log(this.context, `User found by email: ${userEmail}`);
      }

      return user;
    } catch (error) {
      this.logger.error(
        this.context,
        `Failed to find user by email: ${userEmail}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to find user');
    }
  }

  // ========================= SOFT DELETE =========================
  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('User not found');

    user.deletedAt = new Date();
    user.userValidated = false;
    await user.save();

    this.logger.log(this.context, `🗑️ Utilisateur supprimé (soft delete): ${user.userEmail}`);

    // ---------------- 📧 EMAIL OPTIONNEL: Notification compte désactivé ----------------
    try {
      await this.mailService.notificationAccountDeactivated(
        user.userEmail,
        user.userName ?? user.managerName ?? 'Utilisateur',
        'Suppression du compte',
      );
      this.logger.log(this.context, `📧 Email désactivation envoyé à ${user.userEmail}`);
    } catch (mailError) {
      this.logger.error(
        this.context,
        `⚠️ Erreur envoi email désactivation`,
        mailError.stack,
      );
    }

    return {
      status: 'success',
      message: 'User deleted successfully',
      data: null,
    };
  }

  // ========================= ACTIVATE ACCOUNT =========================
  async activateAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: userId, deletedAt: null });
    if (!user) throw new NotFoundException('User not found');

    if (!user.userEmailVerified)
      throw new BadRequestException(
        'Account must be verified before activation',
      );

    if (user.userValidated)
      throw new BadRequestException('Account already active');

    user.userValidated = true;
    await user.save();

    this.logger.log(this.context, `✅ Compte activé: ${user.userEmail}`);

    // ---------------- 📧 EMAIL 4: Compte activé (utilisateur) ----------------
    try {
      const loginLink = `${this.baseUrl}/login`;
      await this.mailService.notificationAccountUserActive(
        user.userEmail,
        user.userName ?? user.managerName ?? 'Utilisateur',
        loginLink,
      );
      this.logger.log(this.context, `📧 Email activation envoyé à ${user.userEmail}`);
    } catch (mailError) {
      this.logger.error(
        this.context,
        `⚠️ Erreur envoi email activation`,
        mailError.stack,
      );
      // On ne bloque pas l'activation
    }

    return this.findOne(userId);
  }

  // ========================= UPDATE USER =========================
  async update(
    id: string,
    dto: UpdateUserDto,
    files: {
      avatar?: Express.Multer.File;
      logo?: Express.Multer.File;
      carteStat?: Express.Multer.File;
      documents?: Express.Multer.File[];
      carteFiscal?: Express.Multer.File[];
    },
  ): Promise<PaginationResult<User>> {
    return this.updateWithFiles(
      id,
      dto,
      files.avatar,
      files.documents,
      dto.documentType,
      files.logo,
      files.carteStat,
      files.carteFiscal,
    );
  }

  // ========================= UPDATE USER WITH FILES =========================
  async updateWithFiles(
    id: string,
    dto: UpdateUserDto,
    avatar?: Express.Multer.File,
    documents?: Express.Multer.File[],
    documentType?: string,
    logo?: Express.Multer.File,
    carteStat?: Express.Multer.File,
    carteFiscal?: Express.Multer.File[],
  ): Promise<PaginationResult<User>> {
    const user = await this.userModel.findOne({ _id: id, deletedAt: null });
    if (!user) throw new NotFoundException('User not found');

    const uploadedFiles: string[] = [];
    const changes: string[] = [];

    try {
      // ---------------- Gestion de l'avatar ----------------
      if (avatar) {
        if (user.userImage && fs.existsSync(user.userImage))
          fs.unlinkSync(user.userImage);
        user.userImage = await this.uploadService.saveFile(avatar, 'avatars');
        uploadedFiles.push(user.userImage);
        changes.push('Photo de profil');
      }

      // ---------------- Gestion du logo ----------------
      if (logo) {
        if (user.logo && fs.existsSync(user.logo)) fs.unlinkSync(user.logo);
        user.logo = await this.uploadService.saveFile(logo, 'logos');
        uploadedFiles.push(user.logo);
        changes.push('Logo');
      }

      // ---------------- Gestion carteStat ----------------
      if (carteStat) {
        if (user.carteStat && fs.existsSync(user.carteStat))
          fs.unlinkSync(user.carteStat);
        user.carteStat = await this.uploadService.saveFile(
          carteStat,
          'carteStat',
        );
        uploadedFiles.push(user.carteStat);
        changes.push('Carte statistique');
      }

      // ---------------- Gestion documents ----------------
      if (documents?.length) {
        // Supprime anciens documents
        for (const docPath of user.identityDocument ?? []) {
          if (fs.existsSync(docPath)) fs.unlinkSync(docPath);
        }

        const savedDocs: string[] = [];
        for (const file of documents) {
          const path = await this.uploadService.saveFile(file, 'documents');
          savedDocs.push(path);
          uploadedFiles.push(path);
        }

        user.identityDocument = savedDocs;
        if (documentType) user.documentType = documentType;
        changes.push('Documents d\'identité');
      }

      // ---------------- Gestion carteFiscal ----------------
      if (carteFiscal?.length) {
        // Supprime anciens fichiers
        for (const cfPath of user.carteFiscal ?? []) {
          if (fs.existsSync(cfPath)) fs.unlinkSync(cfPath);
        }

        const savedCF: string[] = [];
        for (const file of carteFiscal) {
          const path = await this.uploadService.saveFile(file, 'carteFiscal');
          savedCF.push(path);
          uploadedFiles.push(path);
        }
        user.carteFiscal = savedCF;
        changes.push('Carte fiscale');
      }

      // ---------------- Mise à jour des autres champs du DTO ----------------
      Object.keys(dto).forEach((key) => {
        if (dto[key] !== undefined && user[key] !== dto[key]) {
          user[key] = dto[key];
          changes.push(key);
        }
      });

      await user.save();
      this.logger.log(this.context, `🔄 Utilisateur mis à jour: ${user.userEmail}`);

      // ---------------- 📧 EMAIL OPTIONNEL: Notification mise à jour profil ----------------
      if (changes.length > 0) {
        try {
          await this.mailService.notificationProfileUpdated(
            user.userEmail,
            user.userName ?? user.managerName ?? 'Utilisateur',
            changes,
          );
          this.logger.log(this.context, `📧 Email mise à jour profil envoyé à ${user.userEmail}`);
        } catch (mailError) {
          this.logger.error(
            this.context,
            `⚠️ Erreur envoi email mise à jour profil`,
            mailError.stack,
          );
          // On ne bloque pas la mise à jour
        }
      }

      return this.findOne(id);
    } catch (err) {
      // ---------------- Rollback fichiers uploadés en cas d'erreur ----------------
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }

      this.logger.error(
        this.context,
        `Failed to update user: ${id}`,
        err.stack,
      );
      throw err instanceof BadRequestException ||
        err instanceof ConflictException
        ? err
        : new InternalServerErrorException('Failed to update user');
    }
  }

  // ========================= FIND ALL PAGINATED + SEARCH + SORT + FILTER =========================
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
    try {
      const query: any = { deletedAt: null };

      // ------------------ FILTRE ------------------
      if (filter) {
        if (filter.userType) query.userType = filter.userType;
        if (typeof filter.isActive === 'boolean')
          query.isActive = filter.isActive;
        if (typeof filter.isVerified === 'boolean')
          query.isVerified = filter.isVerified;
      }

      // ------------------ RECHERCHE ------------------
      if (search) {
        const regex = new RegExp(search, 'i');
        query.$or = [
          { email: regex },
          { companyName: regex },
          { contactPerson: regex },
        ];
      }

      // ------------------ PAGINATION ------------------
      const skip = (page - 1) * limit;

      // ------------------ TRI ------------------
      const sortOrder = order === 'asc' ? 1 : -1;
      const sortQuery: any = {};
      sortQuery[sortBy] = sortOrder;

      // ------------------ EXECUTE ------------------
      const [data, total] = await Promise.all([
        this.userModel
          .find(query)
          .select('-password')
          .sort(sortQuery)
          .skip(skip)
          .limit(limit),
        this.userModel.countDocuments(query),
      ]);

      return {
        status: 'success',
        message: 'Users fetched successfully',
        data,
        page,
        limit,
        total,
      };
    } catch (error) {
      this.logger.error(this.context, 'Failed to fetch users', error.stack);
      throw new BadRequestException('Invalid query parameters');
    }
  }
}