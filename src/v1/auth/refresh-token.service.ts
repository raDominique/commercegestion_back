import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';
import { randomBytes } from 'crypto';

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private readonly tokenModel: Model<RefreshTokenDocument>,
  ) {}

  async create(
    userId: string,
    expiresIn: number,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const refreshToken = new this.tokenModel({
      userId: new Types.ObjectId(userId),
      token,
      expiresAt,
      ipAddress,
      userAgent,
    });
    await refreshToken.save();
    return refreshToken;
  }

  async revoke(token: string) {
    const refreshToken = await this.tokenModel.findOne({ token });
    if (!refreshToken) return null;

    refreshToken.revoked = true;
    refreshToken.revokedAt = new Date();
    return refreshToken.save();
  }

  async findValid(token: string) {
    return this.tokenModel.findOne({
      token,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });
  }
}
