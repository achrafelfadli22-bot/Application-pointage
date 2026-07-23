import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly client: Client;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET') ?? 'pointage360';
    this.client = new Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: Number(this.config.get<string>('MINIO_PORT') ?? 9000),
      useSSL: this.readBoolean('MINIO_USE_SSL', false),
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
    });
  }

  documentKey(tenantId: string, category: 'leave' | 'employees' | 'exports', filename: string) {
    return `${tenantId}/${category}/${Date.now()}-${filename}`;
  }

  async putObject(key: string, stream: Readable, size: number, metadata?: Record<string, string>) {
    await this.ensureBucket();
    return this.client.putObject(this.bucket, key, stream, size, metadata);
  }

  async presignedGetObject(key: string, expirySeconds: number) {
    await this.ensureBucket();
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async check() {
    await this.ensureBucket();
  }

  private ensureBucket() {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
          await this.client.makeBucket(this.bucket, 'us-east-1');
        }
      })().catch((error) => {
        this.bucketReady = undefined;
        throw error;
      });
    }
    return this.bucketReady;
  }

  private readBoolean(key: string, fallback: boolean) {
    const value = this.config.get<string>(key);
    if (value == null) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
}
