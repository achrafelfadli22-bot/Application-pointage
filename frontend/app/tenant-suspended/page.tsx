'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, LogOut } from 'lucide-react';
import { tokenStore } from '@/lib/api-client';

export default function TenantSuspendedPage() {
  const router = useRouter();
  const session = tokenStore.session;
  const tenantName = session?.tenant?.name ?? 'Votre societe';

  function signOut() {
    tokenStore.clear();
    router.push('/login');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pageBg px-4">
      <section className="w-full max-w-md rounded-xl border border-borderSoft bg-surface p-6 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-dangerBg text-dangerText">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-bodyText">Compte societe suspendu</h1>
            <p className="mt-2 text-sm leading-6 text-mutedText">
              {tenantName} est actuellement suspendue. Les donnees sont conservees, mais l'acces aux modules
              operationnels est bloque jusqu'a reactivation par un super administrateur.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-borderSoft bg-grayCard p-4 text-sm text-mutedText">
          Contactez l'administrateur plateforme ou le support Pointage360 pour reactiver l'abonnement.
        </div>

        <button
          type="button"
          onClick={signOut}
          className="mt-6 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-borderSoft bg-surface px-3 text-sm font-medium text-bodyText transition-colors hover:bg-surfaceHover"
        >
          <LogOut className="h-4 w-4" />
          Se deconnecter
        </button>
      </section>
    </main>
  );
}
