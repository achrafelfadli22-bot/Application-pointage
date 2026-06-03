import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'pointage360',
  'admin123',
  'changeme',
  'change-me',
]);

function enabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());
}

export function shouldEnforceStrongPasswords(config: ConfigService) {
  return config.get<string>('NODE_ENV') === 'production' || enabled(config.get<string>('PASSWORD_POLICY_STRICT'));
}

export function assertStrongPassword(password: string | undefined, config: ConfigService) {
  if (!shouldEnforceStrongPasswords(config) || !password) {
    return;
  }

  const errors: string[] = [];
  if (password.length < 12) errors.push('12 caracteres minimum');
  if (!/[a-z]/.test(password)) errors.push('une minuscule');
  if (!/[A-Z]/.test(password)) errors.push('une majuscule');
  if (!/[0-9]/.test(password)) errors.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('un caractere special');
  if (WEAK_PASSWORDS.has(password.toLowerCase())) errors.push('pas de mot de passe par defaut ou courant');

  if (errors.length > 0) {
    throw new BadRequestException(`Mot de passe insuffisant: ${errors.join(', ')}`);
  }
}
