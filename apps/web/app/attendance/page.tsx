'use client';

import { Clock4, Wrench } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

export default function AttendancePage() {
  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Pointage"
          description="Le module de pointage est temporairement en cours de developpement."
        />

        <section className="rounded-xl border border-borderSoft bg-surface p-8 shadow-card">
          <div className="mx-auto grid max-w-2xl gap-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-accentLight text-accent">
              <Wrench className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xl font-semibold text-bodyText">Fenetre pointage en cours de developpement</p>
              <p className="mt-2 text-sm leading-6 text-mutedText">
                La saisie, la geolocalisation et la validation du pointage seront reactivees apres finalisation du nouveau flux N+1 / N+2.
              </p>
            </div>
            <div className="mx-auto inline-flex items-center gap-2 rounded-lg border border-borderSoft bg-grayCard px-3 py-2 text-sm text-mutedText">
              <Clock4 className="h-4 w-4" />
              Module temporairement indisponible
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
