const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'MINIO_USE_SSL',
  'WEB_ORIGIN',
] as const;

const PLACEHOLDER_VALUES = new Set([
  'change-me-access-secret',
  'change-me-refresh-secret',
  'password',
  'secret',
]);

function read(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : undefined;
}

function isEnabled(config: Record<string, unknown>, key: string) {
  return ['1', 'true', 'yes', 'on'].includes((read(config, key) ?? '').toLowerCase());
}

function assertProduction(condition: boolean, message: string, errors: string[]) {
  if (!condition) {
    errors.push(message);
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const isProduction = read(config, 'NODE_ENV') === 'production';
  if (!isProduction) {
    return config;
  }

  const errors: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    assertProduction(Boolean(read(config, key)), `${key} is required in production`, errors);
  }

  const accessSecret = read(config, 'JWT_ACCESS_SECRET') ?? '';
  const refreshSecret = read(config, 'JWT_REFRESH_SECRET') ?? '';
  const webOrigin = read(config, 'WEB_ORIGIN') ?? '';

  assertProduction(accessSecret.length >= 32, 'JWT_ACCESS_SECRET must be at least 32 characters in production', errors);
  assertProduction(refreshSecret.length >= 32, 'JWT_REFRESH_SECRET must be at least 32 characters in production', errors);
  assertProduction(accessSecret !== refreshSecret, 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different', errors);
  assertProduction(!PLACEHOLDER_VALUES.has(accessSecret), 'JWT_ACCESS_SECRET still uses a placeholder value', errors);
  assertProduction(!PLACEHOLDER_VALUES.has(refreshSecret), 'JWT_REFRESH_SECRET still uses a placeholder value', errors);
  assertProduction(
    webOrigin.split(',').every((origin) => origin.trim().startsWith('https://')) ||
      isEnabled(config, 'ALLOW_INSECURE_ORIGIN'),
    'WEB_ORIGIN must use https:// in production unless ALLOW_INSECURE_ORIGIN=true',
    errors,
  );

  const smtpValues = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].map((key) => read(config, key));
  const hasPartialSmtpConfig = smtpValues.some(Boolean) && !smtpValues.every(Boolean);
  assertProduction(!hasPartialSmtpConfig, 'SMTP_HOST, SMTP_USER and SMTP_PASS must be configured together', errors);

  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
