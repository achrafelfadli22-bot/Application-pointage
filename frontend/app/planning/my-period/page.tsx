'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Entry = { entryDate: string; hours: number };
type Line = {
  id: string;
  taskName: string;
  activity?: string | null;
  user: { id: string; firstName: string; lastName: string };
  site: { id: string; code: string; name: string; project?: { id: string; code: string; name: string } | null };
  entries: Entry[];
};
type PeriodPlanning = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: 'PUBLISHED';
  project?: { id: string; code: string; name: string } | null;
  lines: Line[];
  approvedLeaves: Array<{ userId: string; startDate: string; endDate: string }>;
};

function daysBetween(start: string, end: string) {
  const result: string[] = [];
  const current = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const last = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  while (current <= last) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

function EmployeePlanningPeriodContent() {
  const searchParams = useSearchParams();
  const start = searchParams?.get('start') ?? '';
  const end = searchParams?.get('end') ?? '';
  const projectId = searchParams?.get('projectId') ?? undefined;
  const { data, loading, error } = useApiData<PeriodPlanning>(
    () => start && end
      ? api.planningMyPeriod(start, end, projectId) as Promise<PeriodPlanning>
      : Promise.reject(new Error('Période manquante.')),
    { id: '', periodStart: start, periodEnd: end, status: 'PUBLISHED', lines: [], approvedLeaves: [] },
    { fallbackMode: 'never' },
  );
  const days = start && end ? daysBetween(start, end) : [];
  const title = start && end
    ? `Planification du ${new Date(`${start}T00:00:00Z`).toLocaleDateString('fr-FR')} au ${new Date(`${end}T00:00:00Z`).toLocaleDateString('fr-FR')}`
    : 'Planification de la période';

  function isApprovedLeaveDay(userId: string, day: string) {
    return data.approvedLeaves.some((leave) =>
      leave.userId === userId &&
      leave.startDate.slice(0, 10) <= day &&
      leave.endDate.slice(0, 10) >= day);
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <Link href="/planning" className="flex w-fit items-center gap-2 text-sm text-mutedText hover:text-bodyText"><ArrowLeft className="h-4 w-4" /> Retour aux planifications</Link>
        <PageHeader
          title={title}
          description={start && end ? `${new Date(`${start}T00:00:00Z`).toLocaleDateString('fr-FR')} – ${new Date(`${end}T00:00:00Z`).toLocaleDateString('fr-FR')} · Toutes vos lignes planifiées` : undefined}
          actions={<span className="rounded-full bg-grayCard px-3 py-1.5 text-sm font-semibold text-mutedText">Consultation uniquement</span>}
        />
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && !error && (
          <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-grayCard text-left text-xs uppercase text-mutedText">
                  <tr>
                    <th className="p-3">Projet</th><th className="p-3">Site</th><th className="p-3">Employé</th><th className="p-3">Tâche</th>
                    {days.map((day) => <th key={day} className="p-2 text-center"><span className="block">{new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short' })}</span><span>{new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span></th>)}
                    <th className="p-3 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => {
                    const hours = Object.fromEntries(line.entries.map((entry) => [entry.entryDate.slice(0, 10), Number(entry.hours)]));
                    const total = days.reduce((sum, day) => sum + (hours[day] ?? 0), 0);
                    return (
                      <tr key={line.id} className="border-t border-borderSoft">
                        <td className="p-3 font-medium text-bodyText">{line.site.project ? `${line.site.project.code} - ${line.site.project.name}` : '—'}</td>
                        <td className="p-3">{line.site.code} - {line.site.name}</td>
                        <td className="p-3">{line.user.firstName} {line.user.lastName}</td>
                        <td className="p-3">{line.taskName}</td>
                        {days.map((day) => {
                          const onLeave = isApprovedLeaveDay(line.user.id, day);
                          return (
                            <td key={day} className={`p-2 text-center ${onLeave ? 'bg-sky-50/70' : hours[day] ? 'font-semibold text-accentText' : 'text-hintText'}`} title={onLeave ? 'Congé approuvé' : undefined}>
                              {onLeave ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-sky-700">0 h</span>
                                  <span className="rounded border border-sky-200 bg-sky-100 px-1 text-[10px] font-semibold text-sky-700">Congé</span>
                                </div>
                              ) : hours[day] ? `${hours[day]} h` : '—'}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-bold">{total.toFixed(1)} h</td>
                      </tr>
                    );
                  })}
                  {data.lines.length === 0 && <tr><td colSpan={5 + days.length} className="p-10 text-center text-mutedText">Aucune ligne planifiée pour cette période.</td></tr>}
                </tbody>
                <tfoot><tr className="border-t border-borderSoft bg-surfaceHover"><td colSpan={4 + days.length} className="p-3 font-semibold">Total de la période</td><td className="p-3 text-center font-bold">{data.lines.reduce((sum, line) => sum + line.entries.reduce((lineSum, entry) => lineSum + Number(entry.hours), 0), 0).toFixed(1)} h</td></tr></tfoot>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

export default function EmployeePlanningPeriodPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState /></AppShell>}>
      <EmployeePlanningPeriodContent />
    </Suspense>
  );
}
