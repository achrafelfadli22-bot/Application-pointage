'use client';

import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Person = { id: string; firstName: string; lastName: string };
type Site = {
  id: string;
  code: string;
  name: string;
  project?: { id: string; code: string; name: string } | null;
  manager?: { id: string } | null;
  assignments?: Array<{ user: Person }>;
};
type Project = { id: string; code: string; name: string; sites?: Site[] };
type Entry = { entryDate: string; hours: number; comment?: string };
type PlanningLine = { id: string; user: Person; site: Site; taskName: string; activity?: string | null; entries: Entry[] };
type Planning = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'PUBLISHED';
  lines: PlanningLine[];
  approvedLeaves: Array<{ userId: string; startDate: string; endDate: string }>;
};
type EditLine = { projectId: string; projectLabel: string; userId: string; userLabel: string; siteId: string; siteLabel: string; taskName: string; activity: string; hours: Record<string, number> };

function daysBetween(start: string, end: string) {
  const result: string[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    result.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

function siteLabel(site: Site) {
  return `${site.code} - ${site.name}`;
}

export default function PlanningDetailPage() {
  const id = String(useParams<{ id: string }>()?.id ?? '');
  const { data: planning, loading, error, refresh } = useApiData<Planning>(
    () => api.planning(id) as Promise<Planning>,
    { id: '', periodStart: '', periodEnd: '', status: 'DRAFT', lines: [], approvedLeaves: [] },
    { fallbackMode: 'never' },
  );
  const { data: planningScope, error: scopeError } = useApiData<{ projects: Project[]; sites: Site[] }>(
    () => api.planningScope() as Promise<{ projects: Project[]; sites: Site[] }>,
    { projects: [], sites: [] },
    { fallbackMode: 'never' },
  );
  const canManage = planningScope.sites.length > 0;
  const sites = planningScope.sites;
  const days = useMemo(() => planning.periodStart ? daysBetween(planning.periodStart, planning.periodEnd) : [], [planning.periodStart, planning.periodEnd]);
  const projects = useMemo(
    () => [...planningScope.projects].sort((a, b) => a.code.localeCompare(b.code)),
    [planningScope.projects],
  );
  const [lines, setLines] = useState<EditLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const readonly = !canManage || planning.status === 'PUBLISHED';

  useEffect(() => {
    if (!planning.id) return;
    setLines(planning.lines.map((line) => ({
      projectId: line.site.project?.id ?? '',
      projectLabel: line.site.project ? `${line.site.project.code} - ${line.site.project.name}` : '—',
      userId: line.user.id,
      userLabel: `${line.user.firstName} ${line.user.lastName}`,
      siteId: line.site.id,
      siteLabel: siteLabel(line.site),
      taskName: line.taskName,
      activity: line.activity ?? '',
      hours: Object.fromEntries(line.entries.map((entry) => [entry.entryDate.slice(0, 10), Number(entry.hours)])),
    })));
  }, [planning]);

  function employeesForSite(siteId: string) {
    const site = sites.find((item) => item.id === siteId);
    const unique = new Map<string, Person>();
    for (const assignment of site?.assignments ?? []) unique.set(assignment.user.id, assignment.user);
    return [...unique.values()].sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  }

  function addLine() {
    setLines((current) => [...current, { projectId: '', projectLabel: '', userId: '', userLabel: '', siteId: '', siteLabel: '', taskName: '', activity: '', hours: Object.fromEntries(days.map((day) => [day, 0])) }]);
  }

  function patchLine(index: number, patch: Partial<EditLine>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  function setHours(index: number, day: string, value: string) {
    const hours = Math.max(0, Math.min(24, Number(value) || 0));
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, hours: { ...line.hours, [day]: hours } } : line));
  }

  function isApprovedLeaveDay(userId: string, day: string) {
    return Boolean(userId) && planning.approvedLeaves.some((leave) =>
      leave.userId === userId &&
      leave.startDate.slice(0, 10) <= day &&
      leave.endDate.slice(0, 10) >= day);
  }

  function selectEmployee(index: number, userId: string) {
    const line = lines[index];
    const hours = Object.fromEntries(days.map((day) => [
      day,
      isApprovedLeaveDay(userId, day) ? 0 : (line?.hours[day] ?? 0),
    ]));
    patchLine(index, { userId, hours });
  }

  async function save(showSuccess = true) {
    setBusy(true);
    setActionError(null);
    try {
      await api.updatePlanning(id, {
        lines: lines.map((line) => ({
          userId: line.userId,
          siteId: line.siteId,
          taskName: line.taskName,
          activity: line.activity || undefined,
          entries: days.map((day) => ({ entryDate: day, hours: line.hours[day] ?? 0 })),
        })),
      });
      refresh();
      if (showSuccess) setSuccessMessage('La planification a été sauvegardée.');
      return true;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Sauvegarde impossible.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!(await save(false))) return;
    setBusy(true);
    try {
      await api.publishPlanning(id);
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Publication impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    setActionError(null);
    try {
      await api.reopenPlanning(id);
      await refresh();
      setSuccessMessage('La planification est de nouveau modifiable.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Réouverture impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <AppShell><LoadingState /></AppShell>;

  return (
    <AppShell>
      <div className="grid gap-6">
        <Link href="/planning" className="flex w-fit items-center gap-2 text-sm text-mutedText hover:text-bodyText"><ArrowLeft className="h-4 w-4" /> Retour aux planifications</Link>
        <PageHeader
          title={`Planification ${days.length > 7 ? 'mensuelle' : 'hebdomadaire'}`}
          description={planning.id ? `${new Date(planning.periodStart).toLocaleDateString('fr-FR')} – ${new Date(planning.periodEnd).toLocaleDateString('fr-FR')}` : ''}
          actions={!canManage ? <span className="rounded-full bg-grayCard px-3 py-1.5 text-sm font-semibold text-mutedText">Consultation uniquement</span> : !readonly ? <><SecondaryButton onClick={() => save()} disabled={busy}><Save className="h-4 w-4" /> Sauvegarder</SecondaryButton><ConfirmDialog title="Publier la planification" description="Après publication, les heures planifiées seront utilisées dans la comparaison du tableau de bord." confirmLabel="Publier" tone="primary" onConfirm={publish} trigger={<PrimaryButton type="button" disabled={busy}><Send className="h-4 w-4" /> Publier</PrimaryButton>} /></> : <><span className="rounded-full bg-successBg px-3 py-1.5 text-sm font-semibold text-successText">Publiée · lecture seule</span><ConfirmDialog title="Modifier la planification" description="La planification sera repassée en brouillon. Après vos modifications, vous devrez la publier de nouveau pour actualiser le tableau de bord." confirmLabel="Modifier" tone="primary" onConfirm={reopen} trigger={<SecondaryButton type="button" disabled={busy}><Pencil className="h-4 w-4" /> Modifier</SecondaryButton>} /></>}
        />
        {(error || scopeError || actionError) && <ErrorState message={actionError || scopeError || error || 'Erreur'} />}

        <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-[1250px] w-full text-sm">
              <thead className="bg-grayCard text-left text-xs uppercase text-mutedText">
                <tr>
                  <th className="p-3">Projet</th><th className="p-3">Site</th><th className="p-3">Employé</th><th className="p-3">Tâche</th>
                  {days.map((day) => <th key={day} className="p-2 text-center"><span className="block">{new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short' })}</span><span>{new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span></th>)}
                  <th className="p-3 text-center">Total</th><th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const total = days.reduce((sum, day) => sum + (line.hours[day] ?? 0), 0);
                  return (
                    <tr key={index} className="border-t border-borderSoft">
                      <td className="p-2">
                        {canManage ? <select disabled={readonly} value={line.projectId} onChange={(event) => patchLine(index, { projectId: event.target.value, siteId: '', userId: '' })} className="h-9 w-48 rounded-md border border-borderSoft px-2 disabled:bg-grayCard">
                          <option value="">Choisir un projet</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} - {project.name}</option>)}
                        </select> : <span className="font-medium text-bodyText">{line.projectLabel}</span>}
                      </td>
                      <td className="p-2">{canManage ? <select disabled={readonly || !line.projectId} value={line.siteId} onChange={(event) => patchLine(index, { siteId: event.target.value, userId: '' })} className="h-9 w-48 rounded-md border border-borderSoft px-2 disabled:bg-grayCard"><option value="">Choisir un site</option>{sites.filter((item) => item.project?.id === line.projectId).map((item) => <option key={item.id} value={item.id}>{siteLabel(item)}</option>)}</select> : <span>{line.siteLabel}</span>}</td>
                      <td className="p-2">{canManage ? <select disabled={readonly || !line.siteId} value={line.userId} onChange={(event) => selectEmployee(index, event.target.value)} className="h-9 w-44 rounded-md border border-borderSoft px-2 disabled:bg-grayCard"><option value="">Choisir</option>{employeesForSite(line.siteId).map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select> : <span>{line.userLabel}</span>}</td>
                      <td className="p-2"><input disabled={readonly} value={line.taskName} onChange={(event) => patchLine(index, { taskName: event.target.value })} placeholder="Activité prévue" className="h-9 w-40 rounded-md border border-borderSoft px-2 disabled:bg-grayCard" /></td>
                      {days.map((day) => {
                        const onLeave = isApprovedLeaveDay(line.userId, day);
                        return (
                          <td key={day} className={`p-1 text-center ${onLeave ? 'bg-sky-50/70' : ''}`} title={onLeave ? 'Congé approuvé' : undefined}>
                            <div className="flex flex-col items-center gap-1">
                              <input disabled={readonly || onLeave} type="number" min="0" max="24" step="0.5" value={onLeave ? 0 : (line.hours[day] ?? 0)} onChange={(event) => setHours(index, day, event.target.value)} className={`h-9 w-14 rounded-md border text-center disabled:cursor-not-allowed ${onLeave ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-borderSoft disabled:bg-grayCard'}`} />
                              {onLeave && <span className="rounded border border-sky-200 bg-sky-100 px-1 text-[10px] font-semibold text-sky-700">Congé</span>}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-semibold">{total.toFixed(1)} h</td>
                      <td className="p-2">{!readonly && <button type="button" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded p-2 text-dangerText hover:bg-dangerBg"><Trash2 className="h-4 w-4" /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t border-borderSoft bg-surfaceHover"><td colSpan={4 + days.length} className="p-3 font-semibold">Total planifié</td><td className="p-3 text-center font-bold">{lines.reduce((sum, line) => sum + days.reduce((lineSum, day) => lineSum + (line.hours[day] ?? 0), 0), 0).toFixed(1)} h</td><td /></tr></tfoot>
            </table>
          </div>
          {!readonly && <div className="border-t border-borderSoft p-3"><SecondaryButton onClick={addLine}><Plus className="h-4 w-4" /> Ajouter une ligne</SecondaryButton></div>}
        </section>

        <Dialog.Root open={Boolean(successMessage)} onOpenChange={(open) => !open && setSuccessMessage(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
              <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
                <Dialog.Title className="flex items-center gap-2 font-semibold text-bodyText"><CheckCircle2 className="h-5 w-5 text-successText" /> Opération réussie</Dialog.Title>
                <Dialog.Close className="rounded-md p-1.5 text-mutedText hover:bg-surfaceHover"><X className="h-4 w-4" /></Dialog.Close>
              </div>
              <Dialog.Description className="p-5 text-sm text-mutedText">{successMessage}</Dialog.Description>
              <div className="flex justify-end px-5 pb-5"><Dialog.Close asChild><PrimaryButton type="button">Fermer</PrimaryButton></Dialog.Close></div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </AppShell>
  );
}
