import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type HealthStatus = 'ok' | 'degraded';
type DependencyStatus = 'up' | 'down';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  live() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    };
  }

  async check() {
    const [database, redis, minio] = await Promise.all([
      this.database(),
      this.redis(),
      this.minio(),
    ]);

    const dependencies = { database, redis, minio };
    const status: HealthStatus = Object.values(dependencies).every((item) => item.status === 'up')
      ? 'ok'
      : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  private async database() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' as DependencyStatus };
    } catch (error) {
      return this.down(error);
    }
  }

  private async redis() {
    const client = new Redis({
      host: this.config.get<string>('REDIS_HOST') ?? '127.0.0.1',
      port: Number(this.config.get<string>('REDIS_PORT') ?? 6379),
      family: 4,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on('error', () => undefined);

    try {
      await client.connect();
      await client.ping();
      return { status: 'up' as DependencyStatus };
    } catch (error) {
      return this.down(error);
    } finally {
      client.disconnect();
    }
  }

  private async minio() {
    try {
      await this.storage.check();
      return { status: 'up' as DependencyStatus };
    } catch (error) {
      return this.down(error);
    }
  }

  private down(error: unknown) {
    return {
      status: 'down' as DependencyStatus,
      error: error instanceof Error ? error.message : 'Unavailable',
    };
  }
}
