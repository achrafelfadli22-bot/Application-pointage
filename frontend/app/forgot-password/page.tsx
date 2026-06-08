'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock4, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PrimaryButton } from '@/components/ui/buttons';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [submitting, setSub]  = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) { setError('Adresse email invalide.'); return; }
    setSub(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      // Always show success to avoid email enumeration
      setSent(true);
      void err;
    } finally {
      setSub(false);
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
            <p className="text-sm text-mutedText">Réinitialisation du mot de passe</p>
          </div>
        </div>

        <div className="rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="border-b border-borderSoft px-6 py-4">
            <h2 className="text-base font-semibold text-bodyText">Mot de passe oublié</h2>
            <p className="mt-0.5 text-sm text-mutedText">
              Saisissez votre email pour recevoir un lien de réinitialisation.
            </p>
          </div>

          <div className="p-6">
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-successBg">
                  <CheckCircle2 className="h-6 w-6 text-successText" />
                </div>
                <div>
                  <p className="font-semibold text-bodyText">Email envoyé !</p>
                  <p className="mt-1 text-sm text-mutedText">
                    Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation dans quelques minutes.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium text-bodyText">Adresse email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="nom@societe.ma"
                    className="h-9 w-full rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText placeholder:text-hintText outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
                    {error}
                  </div>
                )}

                <PrimaryButton type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Envoi en cours…' : 'Envoyer le lien'}
                </PrimaryButton>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-mutedText hover:text-bodyText"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
