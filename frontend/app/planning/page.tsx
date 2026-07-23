'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarRange, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton } from '@/components/ui/buttons';
import { ErrorState } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Planning = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt?: string | null;
  lines: Array<{
    site?: { project?: { id: string; code: string; name: string } | null } | null;
    entries: Array<{ hours: number }>;
  }>;
};
type Project = { id: string; code: string; name: string };
type ProjectPlanning = Planning & { project: Project; sourceId: string };
type PlanningScope = { timesheetPeriod: 'WEEKLY' | 'MONTHLY'; timesheetPeriodDays: number; sites: Array<{ id: string }>; isProjectManager: boolean };

function mondayIso() {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  now.setUTCDate(now.getUTCDate() - day);
  return now.toISOString().slice(0, 10);
}

function plusDays(value: string, count: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function rollingMonthEnd(value: string) {
  const start = new Date(`${value}T00:00:00Z`);
  if (start.getUTCDate() === 1) {
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  }
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const lastDayOfNextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate();
  nextMonth.setUTCDate(Math.min(start.getUTCDate() - 1, lastDayOfNextMonth));
  return nextMonth.toISOString().slice(0, 10);
}

function groupEmployeePlannings(plannings: Planning[]) {
  const groups = new Map<string, Planning>();
  for (const planning of plannings) {
    const start = planning.periodStart.slice(0, 10);
    const end = planning.periodEnd.slice(0, 10);
    const key = `${start}:${end}`;
    const existing = groups.get(key);
    if (existing) {
      existing.lines.push(...planning.lines);
    } else {
      groups.set(key, { ...planning, id: key, periodStart: start, periodEnd: end, lines: [...planning.lines] });
    }
  }
  return [...groups.values()].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

function normalizePeriod(planning: Planning) {
  return {
    start: planning.periodStart.slice(0, 10),
    end: planning.periodEnd.slice(0, 10),
  };
}

function groupProjectManagerPlannings(plannings: Planning[]) {
  const projects = new Map<string, { project: Project; periods: Map<string, ProjectPlanning> }>();
  for (const planning of plannings) {
    const { start, end } = normalizePeriod(planning);
    for (const line of planning.lines) {
      const project = line.site?.project;
      if (!project) continue;
      let group = projects.get(project.id);
      if (!group) {
        group = { project, periods: new Map() };
        projects.set(project.id, group);
      }
      const periodKey = `${start}:${end}`;
      const existing = group.periods.get(periodKey);
      if (existing) existing.lines.push(line);
      else group.periods.set(periodKey, { ...planning, id: `${project.id}:${periodKey}`, sourceId: planning.id, project, periodStart: start, periodEnd: end, lines: [line] });
    }
  }
  return [...projects.values()]
    .map(({ project, periods }) => ({ project, periods: [...periods.values()].sort((a, b) => b.periodStart.localeCompare(a.periodStart)) }))
    .sort((a, b) => `${a.project.code} ${a.project.name}`.localeCompare(`${b.project.code} ${b.project.name}`, 'fr'));
}

export default function PlanningPage() {
  const [periodStart, setPeriodStart] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, refresh } = useApiData<Planning[]>(() => api.plannings() as Promise<Planning[]>, []);
  const { data: planningScope, loading: settingsLoading, error: settingsError } = useApiData<PlanningScope>(
    () => api.planningScope() as Promise<PlanningScope>,
    { timesheetPeriod: 'WEEKLY', timesheetPeriodDays: 7, sites: [], isProjectManager: false },
    { fallbackMode: 'never' },
  );
  const canManage = planningScope.sites.length > 0;
  const isProjectManager = planningScope.isProjectManager;
  const isMonthly = String(planningScope.timesheetPeriod).toUpperCase() === 'MONTHLY' || planningScope.timesheetPeriodDays === 30;
  const groupedByProject = canManage || isProjectManager;
  const projectGroups = groupedByProject ? groupProjectManagerPlannings(data) : [];
  const emptyPlannings = canManage ? data.filter((planning) => planning.lines.length === 0) : [];
  const displayedPlannings = groupedByProject ? [] : groupEmployeePlannings(data);
  const selectedDate = periodStart ? new Date(`${periodStart}T00:00:00Z`) : null;
  const periodEnd = selectedDate
    ? isMonthly
      ? rollingMonthEnd(periodStart)
      : plusDays(periodStart, 6)
    : '';

  useEffect(() => {
    if (settingsLoading || periodStart) return;
    if (isMonthly) {
      const now = new Date();
      setPeriodStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10));
    } else {
      setPeriodStart(mondayIso());
    }
  }, [isMonthly, periodStart, settingsLoading]);

  async function create() {
    setCreating(true);
    setActionError(null);
    try {
      const planning = await api.createPlanning({ periodStart, periodEnd }) as Planning;
      window.location.href = `/planning/${planning.id}`;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Impossible de créer la planification.');
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deletePlanning(id);
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Suppression impossible.');
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader title="Planification" description={canManage ? "Préparez les heures de votre équipe par site avant leur réalisation." : isProjectManager ? "Consultez, par période, toutes les lignes planifiées pour vos projets." : "Consultez vos heures planifiées, regroupées par période."} />

        {canManage && <section className="flex flex-col gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card sm:flex-row sm:items-end">
          <label className="grid gap-1 text-sm font-medium text-bodyText">
            Début de la période
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="h-9 rounded-md border border-borderSoft px-3" />
          </label>
          <div className="text-sm text-mutedText sm:pb-1">
            <p>Périodicité : <span className="font-semibold text-bodyText">{isMonthly ? 'Mensuelle' : 'Hebdomadaire'}</span></p>
            <p>{isMonthly ? 'Fin (veille de ce jour dans le mois suivant)' : 'Fin'} : {periodEnd ? new Date(`${periodEnd}T00:00:00Z`).toLocaleDateString('fr-FR') : '—'}</p>
          </div>
          <PrimaryButton type="button" onClick={create} disabled={creating || settingsLoading || !periodStart || !periodEnd} className="sm:ml-auto">
            <Plus className="h-4 w-4" /> {creating ? 'Création…' : 'Nouvelle planification'}
          </PrimaryButton>
        </section>}

        {(error || settingsError || actionError) && <ErrorState message={actionError || settingsError || error || 'Erreur'} />}

        <div className="grid gap-3">
          {(groupedByProject ? projectGroups.length === 0 && emptyPlannings.length === 0 : displayedPlannings.length === 0) && (
            <div className="rounded-xl border border-dashed border-borderSoft bg-surface p-10 text-center text-sm text-mutedText">
              Aucune planification. Choisissez une période pour commencer.
            </div>
          )}
          {emptyPlannings.length > 0 && (
            <section className="grid gap-3 rounded-xl border border-borderSoft bg-grayCard/40 p-3">
              <div className="flex items-center gap-2 px-1">
                <CalendarRange className="h-5 w-5 text-accent" />
                <h2 className="font-semibold text-bodyText">Planifications à compléter</h2>
                <span className="ml-auto text-xs text-mutedText">{emptyPlannings.length} période(s)</span>
              </div>
              {emptyPlannings.map((planning) => (
                <div key={planning.id} className="flex flex-col gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card sm:flex-row sm:items-center">
                  <CalendarRange className="h-5 w-5 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-bodyText">
                      {new Date(planning.periodStart).toLocaleDateString('fr-FR')} – {new Date(planning.periodEnd).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-mutedText">Aucune ligne · 0 h planifiée</p>
                  </div>
                  <span className="w-fit rounded-full bg-grayCard px-2.5 py-1 text-xs font-semibold text-mutedText">Brouillon</span>
                  <Link href={`/planning/${planning.id}`} className="text-sm font-semibold text-accent hover:underline">Compléter</Link>
                  <ConfirmDialog
                    title="Supprimer la planification"
                    description="Cette planification vide sera supprimée définitivement."
                    confirmLabel="Supprimer"
                    onConfirm={() => remove(planning.id)}
                    trigger={<button type="button" className="rounded-md p-2 text-dangerText hover:bg-dangerBg" title="Supprimer"><Trash2 className="h-4 w-4" /></button>}
                  />
                </div>
              ))}
            </section>
          )}
          {groupedByProject && projectGroups.map(({ project, periods }) => (
            <section key={project.id} className="grid gap-3 rounded-xl border border-borderSoft bg-grayCard/40 p-3">
              <div className="flex items-center gap-2 px-1">
                <FolderKanban className="h-5 w-5 text-accent" />
                <h2 className="font-semibold text-bodyText">{project.code} - {project.name}</h2>
                <span className="ml-auto text-xs text-mutedText">{periods.length} période(s)</span>
              </div>
              <div className="grid gap-3">
                {periods.map((planning) => {
                  const total = planning.lines.reduce((sum, line) => sum + line.entries.reduce((lineSum, entry) => lineSum + Number(entry.hours), 0), 0);
                  return (
                    <div key={planning.id} className="flex flex-col gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card sm:flex-row sm:items-center">
                      <CalendarRange className="h-5 w-5 text-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-bodyText">{new Date(planning.periodStart).toLocaleDateString('fr-FR')} – {new Date(planning.periodEnd).toLocaleDateString('fr-FR')}</p>
                        <p className="text-xs text-mutedText">{planning.lines.length} ligne(s) · {total.toFixed(1)} h planifiées</p>
                      </div>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${planning.status === 'PUBLISHED' ? 'bg-successBg text-successText' : 'bg-grayCard text-mutedText'}`}>
                        {planning.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}
                      </span>
                      <Link
                        href={canManage ? `/planning/${planning.sourceId}` : `/planning/my-period?start=${planning.periodStart.slice(0, 10)}&end=${planning.periodEnd.slice(0, 10)}&projectId=${project.id}`}
                        className="text-sm font-semibold text-accent hover:underline"
                      >
                        {canManage ? (planning.status === 'PUBLISHED' ? 'Consulter / modifier' : 'Modifier') : 'Consulter la période'}
                      </Link>
                      {canManage && <ConfirmDialog
                        title="Supprimer la planification"
                        description="Cette planification et toutes ses lignes seront supprimées définitivement."
                        confirmLabel="Supprimer"
                        onConfirm={() => remove(planning.sourceId)}
                        trigger={<button type="button" className="rounded-md p-2 text-dangerText hover:bg-dangerBg" title="Supprimer"><Trash2 className="h-4 w-4" /></button>}
                      />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {displayedPlannings.map((planning) => {
            const total = planning.lines.reduce((sum, line) => sum + line.entries.reduce((lineSum, entry) => lineSum + Number(entry.hours), 0), 0);
            const destination = canManage
              ? `/planning/${planning.id}`
              : `/planning/my-period?start=${planning.periodStart.slice(0, 10)}&end=${planning.periodEnd.slice(0, 10)}`;
            return (
              <div key={planning.id} className="flex flex-col gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card sm:flex-row sm:items-center">
                <CalendarRange className="h-5 w-5 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-bodyText">
                    {new Date(planning.periodStart).toLocaleDateString('fr-FR')} – {new Date(planning.periodEnd).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-xs text-mutedText">{planning.lines.length} ligne(s) · {total.toFixed(1)} h planifiées</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${planning.status === 'PUBLISHED' ? 'bg-successBg text-successText' : 'bg-grayCard text-mutedText'}`}>
                  {planning.status === 'PUBLISHED' ? 'Publiée' : 'Brouillon'}
                </span>
                <Link href={destination} className="text-sm font-semibold text-accent hover:underline">{canManage ? (planning.status === 'PUBLISHED' ? 'Consulter / modifier' : 'Modifier') : 'Consulter la période'}</Link>
                {canManage && <ConfirmDialog
                  title="Supprimer la planification"
                  description="Cette planification et toutes ses lignes seront supprimées définitivement."
                  confirmLabel="Supprimer"
                  onConfirm={() => remove(planning.id)}
                  trigger={<button type="button" className="rounded-md p-2 text-dangerText hover:bg-dangerBg" title="Supprimer"><Trash2 className="h-4 w-4" /></button>}
                />}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
