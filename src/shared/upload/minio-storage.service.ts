import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';

export interface StoredFile {
  stream: Readable;
  contentType?: string;
  size?: number;
}

@Injectable()
export class MinioStorageService {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly publicPath = path.join(process.cwd(), 'upload');
  private readonly client?: Client;
  private readonly bucket?: string;
  private bucketInitialization?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT');
    const port = this.config.get<string>('MINIO_PORT');
    const ssl = this.config.get<string>('MINIO_SSL');
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');
    const bucket = this.config.get<string>('MINIO_BUCKET');

    if (!endpoint || !accessKey || !secretKey || !bucket) return;

    try {
      const url = new URL(
        endpoint.includes('://') ? endpoint : `http://${endpoint}`,
      );
      this.client = new Client({
        endPoint: url.hostname,
        port: port ? Number(port) : url.port ? Number(url.port) : undefined,
        useSSL: ssl ? ssl === 'true' : url.protocol === 'https:',
        accessKey,
        secretKey,
      });
      this.bucket = bucket;
    } catch (error) {
      this.logger.warn(
        `Configuration MinIO invalide; repli local. ${this.errorMessage(error)}`,
      );
    }
  }

  async store(
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    if (this.client && this.bucket) {
      try {
        await this.ensureBucket();
        await this.client.putObject(
          this.bucket,
          objectName,
          buffer,
          buffer.length,
          {
            'Content-Type': contentType || 'application/octet-stream',
          },
        );
        this.logger.log(`Fichier enregistré dans MinIO : ${objectName}`);
        return;
      } catch (error) {
        this.logger.warn(
          `Écriture MinIO impossible pour ${objectName}; repli local. ${this.errorMessage(error)}`,
        );
      }
    }

    const localPath = this.localPath(objectName);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    this.logger.log(`Fichier enregistré localement : ${localPath}`);
  }

  /** Cherche MinIO avant le dossier upload historique. */
  async get(objectName: string): Promise<StoredFile | undefined> {
    const safeObjectName = this.validateObjectName(objectName);
    if (!safeObjectName) return undefined;

    if (this.client && this.bucket) {
      try {
        const stat: unknown = await this.client.statObject(
          this.bucket,
          safeObjectName,
        );
        const metadata = this.objectMetadata(stat);
        return {
          stream: await this.client.getObject(this.bucket, safeObjectName),
          contentType: metadata.contentType,
          size: metadata.size,
        };
      } catch (error) {
        this.logger.warn(
          `Lecture MinIO impossible pour ${safeObjectName}; repli local. ${this.errorMessage(error)}`,
        );
      }
    }

    const localPath = this.localPath(safeObjectName);
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile())
      return undefined;
    return {
      stream: fs.createReadStream(localPath),
      size: fs.statSync(localPath).size,
    };
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketInitialization) {
      this.bucketInitialization = (async () => {
        if (!this.client || !this.bucket) return;
        if (!(await this.client.bucketExists(this.bucket))) {
          await this.client.makeBucket(this.bucket);
        }
      })();
    }
    try {
      await this.bucketInitialization;
    } catch (error) {
      this.bucketInitialization = undefined;
      throw error;
    }
  }

  private localPath(objectName: string): string {
    return path.join(this.publicPath, ...objectName.split('/'));
  }

  private validateObjectName(objectName: string): string | undefined {
    const normalized = objectName.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (
      !normalized ||
      normalized.split('/').some((part) => part === '.' || part === '..')
    )
      return undefined;
    return normalized;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private objectMetadata(stat: unknown): {
    contentType?: string;
    size?: number;
  } {
    if (typeof stat !== 'object' || stat === null) return {};

    const { metaData, size } = stat as {
      metaData?: unknown;
      size?: unknown;
    };
    const contentType =
      typeof metaData === 'object' &&
      metaData !== null &&
      typeof (metaData as Record<string, unknown>)['content-type'] === 'string'
        ? (metaData as Record<string, string>)['content-type']
        : undefined;

    return {
      contentType,
      size: typeof size === 'number' ? size : undefined,
    };
  }
}
