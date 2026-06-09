'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock4, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PrimaryButton } from '@/components/ui/buttons';

function ResetPasswordForm() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const token         = searchParams?.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [submitting, setSub]      = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!token) {
      setError('Lien de réinitialisation invalide ou expiré.');
      return;
    }
    setSub(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lien invalide ou expiré. Demandez un nouveau lien.');
    } finally {
      setSub(false);
    }
  }

  if (!token) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-dangerText">Lien de réinitialisation invalide ou manquant.</p>
        <Link href="/forgot-password" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {done ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-successBg">
            <CheckCircle2 className="h-6 w-6 text-successText" />
          </div>
          <div>
            <p className="font-semibold text-bodyText">Mot de passe modifié !</p>
            <p className="mt-1 text-sm text-mutedText">
              Vous allez être redirigé vers la page de connexion…
            </p>
          </div>
          <Link href="/login" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Se connecter maintenant
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Nouveau mot de passe */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-bodyText">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Minimum 8 caractères"
                className="h-9 w-full rounded-md border border-borderSoft bg-surface px-3 pr-10 text-sm text-bodyText placeholder:text-hintText outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-hintText hover:text-mutedText"
                aria-label={showPwd ? 'Masquer' : 'Afficher'}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmation */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-bodyText">Confirmer le mot de passe</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Répétez le mot de passe"
              className="h-9 w-full rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText placeholder:text-hintText outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              required
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-dangerText">Les mots de passe ne correspondent pas.</p>
            )}
          </div>

          {/* Force indicator */}
          {password.length > 0 && (
            <div className="grid gap-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => {
                  const strength =
                    password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 4
                    : password.length >= 10 && (/[A-Z]/.test(password) || /[0-9]/.test(password)) ? 3
                    : password.length >= 8 ? 2
                    : 1;
                  return (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        level <= strength
                          ? strength === 1 ? 'bg-red-400'
                            : strength === 2 ? 'bg-amber-400'
                            : strength === 3 ? 'bg-blue-400'
                            : 'bg-green-500'
                          : 'bg-borderSoft'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-mutedText">
                {password.length < 8 ? 'Trop court' : password.length < 10 ? 'Acceptable' : password.length < 12 ? 'Bon' : 'Excellent'}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
              {error}
            </div>
          )}

          <PrimaryButton type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Enregistrement…' : 'Réinitialiser le mot de passe'}
          </PrimaryButton>

          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-mutedText hover:text-bodyText">
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
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
            <p className="text-sm text-mutedText">Réinitialisation du mot de passe</p>
          </div>
        </div>

        <div className="rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="border-b border-borderSoft px-6 py-4">
            <h2 className="text-base font-semibold text-bodyText">Nouveau mot de passe</h2>
            <p className="mt-0.5 text-sm text-mutedText">
              Choisissez un nouveau mot de passe sécurisé.
            </p>
          </div>
          <Suspense fallback={<div className="p-6 text-sm text-mutedText">Chargement…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
