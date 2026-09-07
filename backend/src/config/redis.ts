import type { RedisOptions } from 'ioredis';
import type { ConfigService } from '@nestjs/config';

export function redisOptions(config: ConfigService): RedisOptions {
  const connectionUrl = config.get<string>('REDIS_URL');

  if (!connectionUrl) {
    return {
      host: config.get<string>('REDIS_HOST') ?? '127.0.0.1',
      port: Number(config.get<string>('REDIS_PORT') ?? 6379),
      family: 4,
    };
  }

  const url = new URL(connectionUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    family: 4,
  };
}
