'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Person = { id: string; firstName: string; lastName: string };
type Site = { id: string; code: string; name: string; project?: { id: string; code: string; name: string } | null; assignments?: Array<{ user: Person }> };
type Line = { id: string; userId: string; siteId: string; taskName: string; activity?: string | null; user: Person; site: Site; entries: Array<{ entryDate: string; hours: number }>; permissions: { canEdit: boolean } };
type PeriodPlanning = { periodStart: string; periodEnd: string; lines: Line[]; approvedLeaves: Array<{ userId: string; startDate: string; endDate: string }>; permissions: { canAdd: boolean } };
type EditLine = { key: string; editable: boolean; projectId: string; siteId: string; userId: string; projectLabel: string; siteLabel: string; userLabel: string; taskName: string; activity: string; hours: Record<string, number> };
type TaskType = { value: string; label: string; isActive: boolean };

function daysBetween(start: string, end: string) {
  const result: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) { result.push(current.toISOString().slice(0, 10)); current.setUTCDate(current.getUTCDate() + 1); }
  return result;
}

function dayDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

function isWeekend(day: string) {
  const weekDay = dayDate(day).getUTCDay();
  return weekDay === 0 || weekDay === 6;
}

function PeriodContent() {
  const params = useSearchParams();
  const start = params?.get('start') ?? '';
  const end = params?.get('end') ?? '';
  const { data, loading, error, refresh } = useApiData<PeriodPlanning>(
    () => api.planningMyPeriod(start, end) as Promise<PeriodPlanning>,
    { periodStart: start, periodEnd: end, lines: [], approvedLeaves: [], permissions: { canAdd: false } },
    { fallbackMode: 'never' },
  );
  const { data: scope, error: scopeError } = useApiData<{ sites: Site[] }>(
    () => api.planningScope() as Promise<{ sites: Site[] }>, { sites: [] }, { fallbackMode: 'never' },
  );
  const { data: taskTypes, error: taskTypesError } = useApiData<TaskType[]>(
    () => api.settingsTimesheetTaskTypes() as Promise<TaskType[]>,
    [],
    { fallbackMode: 'never' },
  );
  const activeTaskTypes = taskTypes.filter((taskType) => taskType.isActive);
  const taskTypeLabels = Object.fromEntries(taskTypes.map((taskType) => [taskType.value, taskType.label]));
  const days = useMemo(() => daysBetween(start, end), [start, end]);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setLines(data.lines.map((line) => ({
    key: line.id, editable: line.permissions.canEdit, projectId: line.site.project?.id ?? '', siteId: line.site.id, userId: line.user.id,
    projectLabel: line.site.project ? `${line.site.project.code} - ${line.site.project.name}` : '—',
    siteLabel: `${line.site.code} - ${line.site.name}`, userLabel: `${line.user.firstName} ${line.user.lastName}`,
    taskName: line.taskName, activity: line.activity ?? '',
    hours: Object.fromEntries(line.entries.map((entry) => [entry.entryDate.slice(0, 10), Number(entry.hours)])),
  }))), [data]);

  const projects = useMemo(() => {
    const map = new Map<string, NonNullable<Site['project']>>();
    for (const site of scope.sites) if (site.project) map.set(site.project.id, site.project);
    return [...map.values()];
  }, [scope.sites]);
  const patch = (index: number, value: Partial<EditLine>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...value } : line));
  const employees = (siteId: string) => scope.sites.find((site) => site.id === siteId)?.assignments?.map((assignment) => assignment.user) ?? [];
  const onLeave = (userId: string, day: string) => data.approvedLeaves.some((leave) => leave.userId === userId && leave.startDate.slice(0, 10) <= day && leave.endDate.slice(0, 10) >= day);

  function addLine() {
    setLines((current) => [...current, { key: `new-${Date.now()}`, editable: true, projectId: '', siteId: '', userId: '', projectLabel: '', siteLabel: '', userLabel: '', taskName: '', activity: '', hours: Object.fromEntries(days.map((day) => [day, 0])) }]);
  }
  async function save() {
    const editable = lines.filter((line) => line.editable);
    if (editable.some((line) => !line.siteId || !line.userId || !line.activity || !line.taskName.trim())) { setActionError('Le site, l’employé, la tâche et la description sont obligatoires.'); return; }
    setBusy(true); setActionError(null); setSaved(false);
    try {
      await api.savePlanningPeriod({ periodStart: start, periodEnd: end, lines: editable.map((line) => ({
        siteId: line.siteId, userId: line.userId, taskName: line.taskName, activity: line.activity || undefined,
        entries: days.map((day) => ({ entryDate: day, hours: onLeave(line.userId, day) ? 0 : (line.hours[day] ?? 0) })),
      })) });
      await refresh(); setSaved(true);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Sauvegarde impossible.'); } finally { setBusy(false); }
  }

  if (loading) return <AppShell><LoadingState /></AppShell>;
  return <AppShell><div className="grid gap-6">
    <Link href="/planning" className="flex w-fit items-center gap-2 text-sm text-mutedText hover:text-bodyText"><ArrowLeft className="h-4 w-4" /> Changer de période</Link>
    <PageHeader title="Planification de la période" description={`${new Date(`${start}T00:00:00Z`).toLocaleDateString('fr-FR')} – ${new Date(`${end}T00:00:00Z`).toLocaleDateString('fr-FR')} · Tous les projets et sites de votre périmètre`}
      actions={data.permissions.canAdd ? <PrimaryButton type="button" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? 'Sauvegarde…' : 'Sauvegarder'}</PrimaryButton> : <span className="rounded-full bg-grayCard px-3 py-1.5 text-sm font-semibold text-mutedText">Consultation uniquement</span>} />
    {(error || scopeError || taskTypesError || actionError) && <ErrorState message={actionError || taskTypesError || scopeError || error || 'Erreur'} />}
    {saved && <div className="rounded-lg bg-successBg px-4 py-3 text-sm font-semibold text-successText">Planification sauvegardée.</div>}
    <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card"><div className="overflow-x-auto">
      <table className="w-full min-w-[1250px] text-sm"><thead className="bg-grayCard text-left text-xs uppercase text-mutedText"><tr>
        <th className="p-3">Projet</th><th className="p-3">Site</th><th className="p-3">Employé</th><th className="p-3">Tâche</th><th className="p-3">Description</th>
        {days.map((day) => <th key={day} className={`border-b border-borderSoft px-2 py-2.5 text-center text-xs font-semibold ${isWeekend(day) ? 'bg-grayCard text-hintText' : 'text-mutedText'}`}>
          <div className="capitalize">{dayDate(day).toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
          <div className="font-normal normal-case text-hintText">{dayDate(day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div>
        </th>)}<th className="p-3">Total</th><th />
      </tr></thead><tbody>
        {lines.map((line, index) => {
          const total = days.reduce((sum, day) => sum + (onLeave(line.userId, day) ? 0 : (line.hours[day] ?? 0)), 0);
          return <tr key={line.key} className={`border-t border-borderSoft ${line.editable ? '' : 'bg-grayCard/60 text-mutedText'}`}>
            <td className="p-2">{line.editable ? <select value={line.projectId} onChange={(e) => patch(index, { projectId: e.target.value, siteId: '', userId: '' })} className="h-9 w-48 rounded border border-borderSoft px-2"><option value="">Projet</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}</select> : line.projectLabel}</td>
            <td className="p-2">{line.editable ? <select value={line.siteId} disabled={!line.projectId} onChange={(e) => patch(index, { siteId: e.target.value, userId: '' })} className="h-9 w-48 rounded border border-borderSoft px-2 disabled:bg-grayCard"><option value="">Site</option>{scope.sites.filter((s) => s.project?.id === line.projectId).map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}</select> : line.siteLabel}</td>
            <td className="p-2">{line.editable ? <select value={line.userId} disabled={!line.siteId} onChange={(e) => patch(index, { userId: e.target.value })} className="h-9 w-44 rounded border border-borderSoft px-2 disabled:bg-grayCard"><option value="">Employé</option>{employees(line.siteId).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select> : line.userLabel}</td>
            <td className="p-2">{line.editable ? <select value={line.activity} onChange={(e) => patch(index, { activity: e.target.value })} className="h-9 w-44 rounded border border-borderSoft px-2"><option value="">Tâche</option>{activeTaskTypes.map((taskType) => <option key={taskType.value} value={taskType.value}>{taskType.label}</option>)}</select> : (taskTypeLabels[line.activity] ?? line.activity ?? '—')}</td>
            <td className="p-2"><input value={line.taskName} disabled={!line.editable} placeholder="Description" onChange={(e) => patch(index, { taskName: e.target.value })} className="h-9 w-52 rounded border border-borderSoft px-2 disabled:bg-grayCard" /></td>
            {days.map((day) => { const leave = onLeave(line.userId, day); return <td key={day} className={`p-1 text-center ${leave ? 'bg-sky-50' : isWeekend(day) ? 'bg-grayCard/80' : ''}`}><input type="number" min="0" max="24" step="0.5" disabled={!line.editable || leave} value={leave ? 0 : (line.hours[day] ?? 0)} onChange={(e) => patch(index, { hours: { ...line.hours, [day]: Math.max(0, Math.min(24, Number(e.target.value) || 0)) } })} className={`h-9 w-14 rounded border border-borderSoft text-center disabled:bg-grayCard ${isWeekend(day) && !leave ? 'bg-grayCard' : ''}`} />{leave && <span className="mt-1 block text-[10px] font-semibold text-sky-700">Congé</span>}</td>; })}
            <td className="p-2 text-center font-semibold">{total.toFixed(1)} h</td><td className="p-2">{line.editable && <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="rounded p-2 text-dangerText hover:bg-dangerBg"><Trash2 className="h-4 w-4" /></button>}</td>
          </tr>;
        })}
        {!lines.length && <tr><td colSpan={7 + days.length} className="p-10 text-center text-mutedText">Aucune planification pour cette période.</td></tr>}
      </tbody></table>
    </div>{data.permissions.canAdd && <div className="border-t border-borderSoft p-3"><SecondaryButton type="button" onClick={addLine}><Plus className="h-4 w-4" /> Ajouter une ligne</SecondaryButton></div>}</section>
  </div></AppShell>;
}

export default function PlanningPeriodPage() {
  return <Suspense fallback={<AppShell><LoadingState /></AppShell>}><PeriodContent /></Suspense>;
}
