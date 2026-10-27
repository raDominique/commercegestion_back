import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { EmailOtp, EmailOtpDocument } from './email-otp.schema';

@Injectable()
export class EmailOtpService {
  private readonly OTP_TTL_MINUTES = 10;
  private readonly MAX_RESENDS_PER_15_MIN = 3;

  constructor(
    @InjectModel(EmailOtp.name)
    private readonly emailOtpModel: Model<EmailOtpDocument>,
  ) {}

  generateCode(): string {
    // Generate 6 digit code
    const code = crypto.randomInt(100000, 999999).toString();
    return code;
  }

  hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  async canSendCode(userId: string): Promise<boolean> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const count = await this.emailOtpModel.countDocuments({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: fifteenMinutesAgo },
    });
    return count < this.MAX_RESENDS_PER_15_MIN;
  }

  async createCode(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const canSend = await this.canSendCode(userId);
    if (!canSend) {
      throw new BadRequestException(
        'Trop de demandes de code. Veuillez réessayer dans 15 minutes.',
      );
    }

    // Invalidate previous codes for this user
    await this.emailOtpModel.updateMany(
      { userId: new Types.ObjectId(userId), used: false },
      { used: true },
    );

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + this.OTP_TTL_MINUTES * 60 * 1000);

    await this.emailOtpModel.create({
      userId: new Types.ObjectId(userId),
      codeHash,
      expiresAt,
      used: false,
      attempts: 0,
      ipAddress,
      userAgent,
    });

    return { code, expiresAt };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const codeHash = this.hashCode(code);
    const otp = await this.emailOtpModel.findOne({
      userId: new Types.ObjectId(userId),
      codeHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otp) {
      // Increment attempts on most recent unused code if exists
      const recentOtp = await this.emailOtpModel.findOne({
        userId: new Types.ObjectId(userId),
        used: false,
        expiresAt: { $gt: new Date() },
      });
      if (recentOtp) {
        recentOtp.attempts += 1;
        if (recentOtp.attempts >= 3) {
          recentOtp.used = true;
        }
        await recentOtp.save();
      }
      return false;
    }

    if (otp.attempts >= 3) {
      otp.used = true;
      await otp.save();
      return false;
    }

    otp.used = true;
    await otp.save();
    return true;
  }
}
