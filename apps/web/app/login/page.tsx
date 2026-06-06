'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock4, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, tokenStore } from '@/lib/api-client';
import { PrimaryButton } from '@/components/ui/buttons';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe requis'),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'a.elyoussefi@futura-expert.com',
      password: 'Password123!',
    },
  });

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      const session = await api.login(values);
      tokenStore.set(session);
      if (session.tenant?.status === 'SUSPENDED') {
        router.push('/tenant-suspended');
        return;
      }
      router.push(session.role === 'SUPER_ADMIN' ? '/admin/tenants' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants incorrects.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pageBg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy shadow-card">
            <Clock4 className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-bodyText">Pointage360</h1>
            <p className="text-sm text-mutedText">Gestion RH &amp; Chantiers</p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="border-b border-borderSoft px-6 py-4">
            <h2 className="text-base font-semibold text-bodyText">Connexion</h2>
            <p className="mt-0.5 text-sm text-mutedText">Accédez à votre espace RH</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 p-6">
            {/* Email */}
            <div className="grid gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-bodyText">
                Adresse email
              </label>
              <input
                {...form.register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nom@societe.ma"
                className="h-9 w-full rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText placeholder:text-hintText outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-dangerText">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Mot de passe */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-bodyText">
                  Mot de passe
                </label>
                <Link href="/forgot-password" className="text-xs text-accent hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...form.register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-9 w-full rounded-md border border-borderSoft bg-surface px-3 pr-10 text-sm text-bodyText placeholder:text-hintText outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-hintText hover:text-mutedText"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-dangerText">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Erreur API */}
            {error && (
              <div className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
                {error}
              </div>
            )}

            <PrimaryButton type="submit" disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
            </PrimaryButton>
          </form>
        </div>

        {/* Comptes de test */}
        <div className="mt-4 rounded-lg border border-borderSoft bg-surface p-4 text-xs text-mutedText">
          <p className="mb-1.5 font-medium text-bodyText">Comptes de test</p>
          <p>a.elyoussefi@futura-expert.com</p>
          <p>Compte Ressource Manager - Futura Expertise</p>
          <p className="mt-1.5 text-hintText">Mot de passe : Password123!</p>
        </div>
      </div>
    </main>
  );
}
