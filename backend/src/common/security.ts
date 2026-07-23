import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

function isEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());
}

export function parseAllowedOrigins(config: ConfigService) {
  const raw = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureSecurity(app: INestApplication, config: ConfigService) {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const express = app.getHttpAdapter().getInstance();

  if (typeof express.disable === 'function') {
    express.disable('x-powered-by');
  }

  if (isProduction || isEnabled(config.get<string>('TRUST_PROXY'))) {
    express.set?.('trust proxy', 1);
  }

  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=()');
    response.setHeader(
      'Content-Security-Policy',
      request.path.startsWith('/api/docs')
        ? "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
        : "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );

    if (isProduction) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  });
}

export function isSwaggerEnabled(config: ConfigService) {
  const value = config.get<string>('SWAGGER_ENABLED');
  if (value != null) {
    return isEnabled(value);
  }

  return config.get<string>('NODE_ENV') !== 'production';
}
