import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserType } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { UploadService } from 'src/shared/upload/upload.service';
import { randomUUID, randomBytes } from 'node:crypto';
import { validateDocumentMime } from './users.helper';
import * as fs from 'node:fs';
import { MailService } from 'src/shared/mail/mail.service';
import { UserVerificationToken } from './user-verification.schema';
import { ConfigService } from '@nestjs/config';
import { NotifyHelper } from 'src/shared/helpers/notify.helper';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { SiteService } from '../sites/sites.service';
import { CreateSiteDto } from '../sites/dto/create-site.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly baseUrl: string;

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
  ) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  // ========================= CREATE USER =========================
  async createWithFiles(dto: CreateUserDto, files: any = {}): Promise<User> {
    const uploadedFiles: string[] = [];

    try {
      // ===================== Vérification email unique =====================
      const exists = await this.userModel.findOne({
        userEmail: dto.userEmail.toLowerCase(),
        deletedAt: null,
      });
      if (exists) throw new ConflictException('Email déjà utilisé');

      // ===================== Validation entreprise =====================
      if (
        dto.userType === 'Entreprise' &&
        (!dto.managerName || !dto.managerEmail)
      ) {
        throw new BadRequestException(
          'managerName et managerEmail obligatoires',
        );
      }

      // ===================== Validation documents =====================
      if (files.documents?.length) {
        validateDocumentMime(files.documents, dto.documentType);
      }
      if (files.carteFiscal?.length) {
        validateDocumentMime(files.carteFiscal, 'carte-fiscale');
      }

      // ===================== Upload avatar =====================
      const avatarPath = files.avatar
        ? await this.uploadService.saveFile(files.avatar, 'avatars')
        : undefined;
      if (avatarPath) uploadedFiles.push(avatarPath);

      // ===================== Upload logo =====================
      const logoPath = files.logo
        ? await this.uploadService.saveFile(files.logo, 'logos')
        : undefined;
      if (logoPath) uploadedFiles.push(logoPath);

      // ===================== Création utilisateur =====================
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

      // ===================== Audit + notification =====================
      await this.notifyHelper.notify({
        action: AuditAction.CREATE,
        entityType: EntityType.USER,
        entityId: user._id.toString(),
        userId: user._id.toString(), // fallback (pas encore d’admin connecté)
        newState: user.toObject(),
        emailData: { type: 'CREATE' },
      });

      // ===================== Token de vérification =====================
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await this.verificationTokenModel.create({
        userId: user._id,
        token,
        expiresAt,
      });

      // ===================== Email vérification =====================
      await this.mailService.verificationAccountUser(
        user.userEmail,
        user.userName ?? user.managerName ?? 'Utilisateur',
        `${this.baseUrl}/api/v1/users/verify?token=${token}`,
      );

      // ===================== Création site principal =====================
      const siteDto = {
        siteName: `${user.userName ?? 'Utilisateur'} - Site principal`,
        siteAddress: user.userAddress ?? '',
        siteLat: Number(user.userMainLat) || 0,
        siteLng: Number(user.userMainLng) || 0,
      };

      await this.siteService.create(siteDto, user._id.toString());

      return user;
    } catch (err) {
      // ===================== Rollback fichiers =====================
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      throw err;
    }
  }

  // ========================= VERIFY ACCOUNT =========================
  async verifyAccountToken(token: string): Promise<PaginationResult<User>> {
    const tokenDoc = await this.verificationTokenModel.findOne({ token });
    if (!tokenDoc || tokenDoc.expiresAt < new Date())
      throw new BadRequestException('Token invalide ou expiré');

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    user.userEmailVerified = true;
    await user.save();
    await tokenDoc.deleteOne();

    await this.notifyHelper.notify({
      action: AuditAction.UPDATE,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      userId: user._id.toString(),
      previousState: { userEmailVerified: false },
      newState: { userEmailVerified: true },
      emailData: { type: 'UPDATE' },
    });

    return {
      status: 'success',
      message: 'Compte vérifié',
      data: [user],
    };
  }

  // ========================= ACTIVATE =========================
  async activateAccount(userId: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    user.userValidated = true;
    await user.save();

    await this.notifyHelper.notify({
      action: AuditAction.UPDATE,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      userId: user._id.toString(),
      previousState: { userValidated: false },
      newState: { userValidated: true },
      emailData: { type: 'UPDATE' },
    });

    return this.findOne(userId);
  }

  // ========================= DELETE =========================
  async remove(id: string): Promise<PaginationResult<null>> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    user.deletedAt = new Date();
    await user.save();

    await this.notifyHelper.notify({
      action: AuditAction.DELETE,
      entityType: EntityType.USER,
      entityId: user._id.toString(),
      userId: user._id.toString(),
      previousState: user.toObject(),
      emailData: { type: 'DELETE' },
    });

    return {
      status: 'success',
      message: 'User deleted',
      data: null,
    };
  }

  // ======================== UPDATE ========================
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
      if (avatar) {
        if (user.userImage && fs.existsSync(user.userImage))
          fs.unlinkSync(user.userImage);

        user.userImage = await this.uploadService.saveFile(avatar, 'avatars');
        uploadedFiles.push(user.userImage);
        changes.push('Avatar');
      }

      if (logo) {
        if (user.logo && fs.existsSync(user.logo)) fs.unlinkSync(user.logo);

        user.logo = await this.uploadService.saveFile(logo, 'logos');
        uploadedFiles.push(user.logo);
        changes.push('Logo');
      }

      if (documents?.length) {
        for (const doc of user.identityDocument ?? []) {
          if (fs.existsSync(doc)) fs.unlinkSync(doc);
        }

        const savedDocs: string[] = [];
        for (const file of documents) {
          const path = await this.uploadService.saveFile(file, 'documents');
          savedDocs.push(path);
          uploadedFiles.push(path);
        }

        user.identityDocument = savedDocs;
        if (documentType) user.documentType = documentType;
        changes.push('Documents');
      }

      Object.keys(dto).forEach((key) => {
        if (dto[key] !== undefined && user[key] !== dto[key]) {
          user[key] = dto[key];
          changes.push(key);
        }
      });

      await user.save();

      // 🔔 Notification helper
      await this.notifyHelper.notify({
        action: AuditAction.UPDATE,
        entityType: EntityType.USER,
        entityId: user._id.toString(),
        userId: user._id.toString(),
        previousState: null,
        newState: user.toObject(),
      });

      return {
        status: 'success',
        message: 'Utilisateur mis à jour',
        data: [user],
      };
    } catch (err) {
      for (const f of uploadedFiles) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      throw err;
    }
  }

  // ========================= GET =========================
  async findOne(id: string): Promise<PaginationResult<User>> {
    const user = await this.userModel.findById(id).select('-password');
    if (!user) throw new NotFoundException('User not found');

    return { status: 'success', message: 'OK', data: [user] };
  }

  async findAll(): Promise<PaginationResult<User>> {
    const users = await this.userModel.find({ deletedAt: null });
    return { status: 'success', message: 'OK', data: users };
  }

  async getById(userId: string): Promise<User | null> {
    return this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      deletedAt: null,
    });
  }

  async existsById(userId: string): Promise<boolean> {
    return (
      (await this.userModel.countDocuments({
        _id: new Types.ObjectId(userId),
        deletedAt: null,
      })) > 0
    );
  }

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

    // ---------- Filtres ----------
    if (filter?.userType) query.userType = filter.userType;
    if (typeof filter?.isActive === 'boolean')
      query.userValidated = filter.isActive;
    if (typeof filter?.isVerified === 'boolean')
      query.userEmailVerified = filter.isVerified;

    // ---------- Recherche ----------
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { userEmail: regex },
        { userName: regex },
        { managerName: regex },
      ];
    }

    const skip = (page - 1) * limit;
    const sortOrder = order === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
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
  }

  async findByEmailWithPassword(userEmail: string): Promise<User | null> {
    try {
      const user = await this.userModel
        .findOne({ userEmail: userEmail.toLowerCase(), deletedAt: null })
        .select('+userPassword')
        .exec();
      return user;
    } catch (error) {
      throw new InternalServerErrorException('Failed to find user');
    }
  }
}
