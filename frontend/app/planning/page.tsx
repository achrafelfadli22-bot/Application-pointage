'use client';

import { useMemo, useState } from 'react';
import { CalendarSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton } from '@/components/ui/buttons';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type PlanningScope = {
  timesheetPeriod: 'WEEKLY' | 'MONTHLY';
  timesheetPeriodDays: number;
};

function periodEnd(start: string, monthly: boolean) {
  const date = new Date(`${start}T00:00:00Z`);
  if (monthly) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const dayBeforeSameDay = date.getUTCDate() - 1;
    const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
    date.setTime(Date.UTC(year, month + 1, Math.min(dayBeforeSameDay, lastDayOfNextMonth)));
  } else {
    date.setUTCDate(date.getUTCDate() + 6);
  }
  return date.toISOString().slice(0, 10);
}

export default function PlanningPage() {
  const router = useRouter();
  const [start, setStart] = useState('');
  const { data: scope, loading, error } = useApiData<PlanningScope>(
    () => api.planningScope() as Promise<PlanningScope>,
    { timesheetPeriod: 'WEEKLY', timesheetPeriodDays: 7 },
    { fallbackMode: 'never' },
  );
  const monthly = scope.timesheetPeriod === 'MONTHLY' || scope.timesheetPeriodDays === 30;
  const end = useMemo(() => start ? periodEnd(start, monthly) : '', [start, monthly]);

  function consult() {
    if (!start || !end) return;
    router.push(`/planning/my-period?start=${start}&end=${end}`);
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Planification"
          description="Consultez la planification consolidée de tous les projets et sites compris dans votre périmètre."
        />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <section className="max-w-2xl rounded-xl border border-borderSoft bg-surface p-6 shadow-card">
            <div className="grid gap-5">
              <div>
                <label htmlFor="planning-start" className="mb-2 block text-sm font-semibold text-bodyText">
                  Début de la période
                </label>
                <input
                  id="planning-start"
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className="h-10 w-full rounded-md border border-borderSoft bg-surface px-3"
                />
              </div>
              <div className="rounded-lg bg-grayCard p-4 text-sm text-mutedText">
                <span className="font-semibold text-bodyText">Période sélectionnée : </span>
                {start
                  ? `${new Date(`${start}T00:00:00Z`).toLocaleDateString('fr-FR')} – ${new Date(`${end}T00:00:00Z`).toLocaleDateString('fr-FR')}`
                  : `Choisissez le premier jour de la période ${monthly ? 'mensuelle glissante' : 'hebdomadaire'}.`}
              </div>
              <PrimaryButton type="button" onClick={consult} disabled={!start}>
                <CalendarSearch className="h-4 w-4" /> Consulter
              </PrimaryButton>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
