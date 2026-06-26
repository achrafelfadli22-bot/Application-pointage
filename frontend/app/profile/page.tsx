'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, KeyRound, UserCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { FormField } from '@/components/ui/form-fields';
import { api, tokenStore } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-items';

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName:  z.string().min(1, 'Nom requis'),
  phone:     z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword:     z.string().min(8, '8 caractères minimum'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type ProfileForm   = z.infer<typeof profileSchema>;
type PasswordForm  = z.infer<typeof passwordSchema>;

// ── Composant principal ───────────────────────────────────────────────────────

export default function ProfilePage() {
  const session = tokenStore.session;
  const user    = session?.user;

  const [profileSaved,   setProfileSaved]   = useState(false);
  const [profileError,   setProfileError]   = useState<string | null>(null);
  const [passwordSaved,  setPasswordSaved]  = useState(false);
  const [passwordError,  setPasswordError]  = useState<string | null>(null);

  // ── Profile form ──────────────────────────────────────────────────────────
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName:  user?.lastName  ?? '',
      phone:     (user as { phone?: string })?.phone ?? '',
    },
  });

  async function onProfileSubmit(values: ProfileForm) {
    setProfileError(null);
    setProfileSaved(false);
    try {
      await api.updateProfile(values);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour');
    }
  }

  // ── Password form ─────────────────────────────────────────────────────────
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onPasswordSubmit(values: PasswordForm) {
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await api.changePassword({
        currentPassword: values.currentPassword,
        newPassword:     values.newPassword,
      });
      setPasswordSaved(true);
      passwordForm.reset();
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Erreur lors du changement de mot de passe');
    }
  }

  return (
    <AppShell>
      <div className="grid max-w-2xl gap-6">

        <PageHeader
          title="Mon profil"
          description="Gérez vos informations personnelles et votre mot de passe."
        />

        {/* ── Identité ─────────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="flex items-center gap-3 border-b border-borderSoft px-6 py-4">
            <UserCircle className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-bodyText">Informations personnelles</h2>
          </div>

          {/* Avatar + rôle */}
          <div className="flex items-center gap-4 border-b border-borderSoft px-6 py-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accentLight text-xl font-bold text-accentText">
              {(user?.firstName?.[0] ?? '').toUpperCase()}
              {(user?.lastName?.[0]  ?? '').toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-bodyText">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-mutedText">
                {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''}
              </p>
              <p className="text-xs text-hintText">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="grid gap-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Prénom"
                placeholder="Prénom"
                value={profileForm.watch('firstName')}
                onChange={(e) => profileForm.setValue('firstName', e.target.value)}
                error={profileForm.formState.errors.firstName?.message}
              />
              <FormField
                label="Nom"
                placeholder="Nom de famille"
                value={profileForm.watch('lastName')}
                onChange={(e) => profileForm.setValue('lastName', e.target.value)}
                error={profileForm.formState.errors.lastName?.message}
              />
            </div>
            <FormField
              label="Téléphone (optionnel)"
              type="tel"
              placeholder="+212 6 00 00 00 00"
              value={profileForm.watch('phone') ?? ''}
              onChange={(e) => profileForm.setValue('phone', e.target.value)}
            />

            {profileError && (
              <p className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
                {profileError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <PrimaryButton type="submit" disabled={profileForm.formState.isSubmitting} className="w-fit">
                {profileForm.formState.isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
              </PrimaryButton>
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-successText">
                  <CheckCircle2 className="h-4 w-4" /> Profil mis à jour
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ── Mot de passe ─────────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="flex items-center gap-3 border-b border-borderSoft px-6 py-4">
            <KeyRound className="h-5 w-5 text-accent" />
            <h2 className="text-sm font-semibold text-bodyText">Changer le mot de passe</h2>
          </div>

          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid gap-4 px-6 py-5">
            <FormField
              label="Mot de passe actuel"
              type="password"
              placeholder="••••••••"
              value={passwordForm.watch('currentPassword')}
              onChange={(e) => passwordForm.setValue('currentPassword', e.target.value)}
              error={passwordForm.formState.errors.currentPassword?.message}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Nouveau mot de passe"
                type="password"
                placeholder="8 caractères minimum"
                value={passwordForm.watch('newPassword')}
                onChange={(e) => passwordForm.setValue('newPassword', e.target.value)}
                error={passwordForm.formState.errors.newPassword?.message}
              />
              <FormField
                label="Confirmer le nouveau mot de passe"
                type="password"
                placeholder="••••••••"
                value={passwordForm.watch('confirmPassword')}
                onChange={(e) => passwordForm.setValue('confirmPassword', e.target.value)}
                error={passwordForm.formState.errors.confirmPassword?.message}
              />
            </div>

            {passwordError && (
              <p className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
                {passwordError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <PrimaryButton type="submit" disabled={passwordForm.formState.isSubmitting} className="w-fit">
                {passwordForm.formState.isSubmitting ? 'Mise à jour…' : 'Changer le mot de passe'}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => passwordForm.reset()}
                className="w-fit"
              >
                Annuler
              </SecondaryButton>
              {passwordSaved && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-successText">
                  <CheckCircle2 className="h-4 w-4" /> Mot de passe modifié
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ── Infos compte (lecture seule) ──────────────────────────────────── */}
        <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="border-b border-borderSoft px-6 py-4">
            <h2 className="text-sm font-semibold text-bodyText">Informations du compte</h2>
          </div>
          <dl className="grid divide-y divide-borderSoft">
            {[
              { label: 'Adresse email',    value: user?.email ?? '—' },
              { label: 'Rôle',             value: user?.role ? (ROLE_LABELS[user.role] ?? user.role) : '—' },
              { label: 'Organisation',     value: session?.tenant?.name ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-6 py-3">
                <dt className="text-sm text-mutedText">{label}</dt>
                <dd className="text-sm font-medium text-bodyText text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

      </div>
    </AppShell>
  );
}
