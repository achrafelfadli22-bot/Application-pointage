'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Save, Send, ThumbsUp, Undo2, X } from 'lucide-react';
import { api, tokenStore } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { DangerButton, GhostButton, PrimaryButton, SecondaryButton } from '../ui/buttons';
import { StatusBadge } from '../ui/status-badge';
import { DEFAULT_TIMESHEET_TASK_TYPES, type TimesheetTaskType } from '@/lib/timesheet-task-types';

const SHORT_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const billingLabels: Record<string, string> = {
  BILLABLE: 'Facturable',
  NON_BILLABLE: 'Non facturable',
};

const locationLabels: Record<string, string> = {
  SITE: 'Chantier',
  OFFICE: 'Bureau',
  HOME: 'Domicile',
  TRAVEL: 'Deplacement',
};

type Entry = { entryDate: string; hours: number; comment?: string };
type ProjectOption = { id: string; code: string; name: string };
type SiteOption = {
  id: string;
  code: string;
  name: string;
  project?: ProjectOption | null;
};

type Line = {
  taskName: string;
  billingType: string;
  activity?: string | null;
  workLocation: string;
  placeOfWork?: string | null;
  site?: SiteOption | null;
  entries: Entry[];
};

type Timesheet = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  rejectionReason?: string | null;
  user: { id: string; firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string } | null;
  lines: Line[];
};

type EditRow = {
  projectId: string;
  siteId: string;
  taskName: string;
  billingType: string;
  activity: string;
  workLocation: string;
  placeOfWork: string;
  hoursMap: Record<string, number>;
};

function getDays(start: string, end: string): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function frShort(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function weekDayShort(d: Date) {
  return SHORT_DAYS[(d.getUTCDay() + 6) % 7]!;
}

function emptyHours(days: Date[]) {
  return Object.fromEntries(days.map((day) => [dateKey(day), 0]));
}

export function TimesheetGrid({ timesheet, onRefresh }: { timesheet: Timesheet; onRefresh?: () => void }) {
  const router = useRouter();
  const days = getDays(timesheet.periodStart, timesheet.periodEnd);
  const { data: projects } = useApiData<ProjectOption[]>(() => api.projects() as Promise<ProjectOption[]>, []);
  const { data: sites } = useApiData<SiteOption[]>(() => api.sites() as Promise<SiteOption[]>, []);
  const { data: taskTypes } = useApiData<TimesheetTaskType[]>(
    () => api.settingsTimesheetTaskTypes() as Promise<TimesheetTaskType[]>,
    DEFAULT_TIMESHEET_TASK_TYPES,
  );
  const activeTaskTypes = taskTypes.filter((taskType) => taskType.isActive);
  const taskTypeLabels = Object.fromEntries(taskTypes.map((item) => [item.value, item.label]));
  const defaultTaskType = activeTaskTypes[0]?.value ?? DEFAULT_TIMESHEET_TASK_TYPES[0]!.value;

  const myRole = tokenStore.session?.role ?? '';
  const myUserId = tokenStore.session?.user?.id ?? '';
  const isOwner = timesheet.user.id === myUserId;
  const isApprover = ['HR', 'PROJECT_MANAGER', 'MANAGER'].includes(myRole);
  const isReopener = ['HR'].includes(myRole);

  const isDraftOrReopened = ['DRAFT', 'REOPENED'].includes(timesheet.status);
  const isWaitingApproval = ['SUBMITTED', 'N1_APPROVED'].includes(timesheet.status);
  const isApprovedOrRejected = ['APPROVED', 'REJECTED'].includes(timesheet.status);

  const canEdit = isDraftOrReopened && (isOwner || isApprover);
  const canSubmit = isDraftOrReopened && isOwner;
  const canApprove = isWaitingApproval && isApprover;
  const canReject = isWaitingApproval && isApprover;
  const canReopen = isApprovedOrRejected && isReopener;

  const buildRows = (): EditRow[] =>
    timesheet.lines.map((line) => ({
      projectId: line.site?.project?.id ?? '',
      siteId: line.site?.id ?? '',
      taskName: line.taskName,
      billingType: line.billingType || 'BILLABLE',
      activity: line.activity || 'EXECUTION',
      workLocation: line.workLocation || 'SITE',
      placeOfWork: line.placeOfWork || line.site?.name || '',
      hoursMap: Object.fromEntries(line.entries.map((entry) => [entry.entryDate.slice(0, 10), Number(entry.hours)])),
    }));

  const [rows, setRows] = useState<EditRow[]>(buildRows);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patchRow(rowIndex: number, patch: Partial<EditRow>) {
    setRows((previous) => previous.map((row, index) => (index === rowIndex ? { ...row, ...patch } : row)));
  }

  function setHours(rowIndex: number, day: Date, value: string) {
    const hours = Math.max(0, Math.min(24, parseFloat(value) || 0));
    setRows((previous) =>
      previous.map((row, index) =>
        index === rowIndex ? { ...row, hoursMap: { ...row.hoursMap, [dateKey(day)]: hours } } : row,
      ),
    );
  }

  function setProject(rowIndex: number, projectId: string) {
    patchRow(rowIndex, { projectId, siteId: '', placeOfWork: '' });
  }

  function setSite(rowIndex: number, siteId: string) {
    const site = sites.find((item) => item.id === siteId);
    patchRow(rowIndex, {
      siteId,
      projectId: site?.project?.id ?? '',
      placeOfWork: site?.name ?? '',
      workLocation: siteId ? 'SITE' : 'OFFICE',
    });
  }

  function addRow() {
    setRows((previous) => [
      ...previous,
      {
        projectId: '',
        siteId: '',
        taskName: '',
        billingType: 'BILLABLE',
        activity: defaultTaskType,
        workLocation: 'SITE',
        placeOfWork: '',
        hoursMap: emptyHours(days),
      },
    ]);
  }

  function removeRow(rowIndex: number) {
    setRows((previous) => previous.filter((_, index) => index !== rowIndex));
  }

  function sitesForRow(row: EditRow) {
    return row.projectId ? sites.filter((site) => site.project?.id === row.projectId) : sites;
  }

  async function handleSave() {
    const invalidRow = rows.find(
      (row) => !row.taskName.trim() || !row.activity || (row.workLocation === 'SITE' && !row.siteId),
    );
    if (invalidRow) {
      setError('Chaque ligne doit avoir un type de tache, un chantier et une description.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.updateTimesheet(timesheet.id, {
        lines: rows.map((row) => ({
          siteId: row.siteId || undefined,
          taskName: row.taskName.trim(),
          billingType: row.billingType,
          activity: row.activity,
          workLocation: row.workLocation,
          placeOfWork: row.placeOfWork || undefined,
          entries: days.map((day) => ({ entryDate: dateKey(day), hours: row.hoursMap[dateKey(day)] ?? 0 })),
        })),
      });
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function doTransition(action: () => Promise<unknown>, goBack = false) {
    setTransitioning(true);
    setError(null);
    try {
      await action();
      if (goBack) router.push('/timesheets');
      else onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setTransitioning(false);
    }
  }

  const totalByDay = days.map((day) => rows.reduce((sum, row) => sum + (row.hoursMap[dateKey(day)] ?? 0), 0));
  const grandTotal = totalByDay.reduce((sum, value) => sum + value, 0);
  const periodLabel = `${new Date(timesheet.periodStart).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })} - ${new Date(timesheet.periodEnd).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;

  return (
    <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
      <div className="flex flex-col gap-4 border-b border-borderSoft p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mutedText">
            {timesheet.user.firstName} {timesheet.user.lastName}
          </p>
          <p className="mt-0.5 text-base font-semibold text-bodyText">{periodLabel}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={timesheet.status} />
            {timesheet.rejectionReason && <span className="text-xs text-dangerText">- {timesheet.rejectionReason}</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <SecondaryButton type="button" onClick={handleSave} disabled={saving || transitioning}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sauvegarder
            </SecondaryButton>
          )}
          {canSubmit && (
            <ConfirmDialog
              title="Soumettre la timesheet"
              description="La timesheet sera soumise a validation."
              confirmLabel="Soumettre"
              onConfirm={() => doTransition(() => api.submitTimesheet(timesheet.id))}
              trigger={
                <PrimaryButton type="button" disabled={transitioning}>
                  <Send className="h-4 w-4" /> Soumettre
                </PrimaryButton>
              }
            />
          )}
          {canApprove && (
            <ConfirmDialog
              title="Approuver la timesheet"
              description={`Approuver la timesheet de ${timesheet.user.firstName} ${timesheet.user.lastName} ?`}
              confirmLabel="Approuver"
              onConfirm={() => doTransition(() => api.approveTimesheet(timesheet.id))}
              trigger={
                <SecondaryButton type="button" disabled={transitioning}>
                  <ThumbsUp className="h-4 w-4" /> Approuver
                </SecondaryButton>
              }
            />
          )}
          {canReject && (
            <ConfirmDialog
              title="Refuser la timesheet"
              description={`Refuser la timesheet de ${timesheet.user.firstName} ${timesheet.user.lastName} ?`}
              confirmLabel="Refuser"
              onConfirm={() => doTransition(() => api.rejectTimesheet(timesheet.id, 'Refuse par le gestionnaire'))}
              trigger={
                <DangerButton type="button" disabled={transitioning}>
                  <X className="h-4 w-4" /> Refuser
                </DangerButton>
              }
            />
          )}
          {canReopen && (
            <ConfirmDialog
              title="Rouvrir la timesheet"
              description="La timesheet repassera en brouillon pour modification."
              confirmLabel="Rouvrir"
              onConfirm={() => doTransition(() => api.reopenTimesheet(timesheet.id))}
              trigger={
                <SecondaryButton type="button" disabled={transitioning}>
                  <Undo2 className="h-4 w-4" /> Rouvrir
                </SecondaryButton>
              }
            />
          )}
        </div>
      </div>

      {error && <div className="border-b border-dangerBorder bg-dangerBg px-5 py-3 text-sm text-dangerText">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1240px] border-collapse text-sm">
          <thead>
            <tr className="bg-grayCard">
              <th className="border-b border-borderSoft px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mutedText">Projet</th>
              <th className="border-b border-borderSoft px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mutedText">Chantier</th>
              <th className="border-b border-borderSoft px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mutedText">Type</th>
              <th className="border-b border-borderSoft px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mutedText">Description</th>
              <th className="border-b border-borderSoft px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-mutedText">Fact.</th>
              {days.map((day) => (
                <th
                  key={dateKey(day)}
                  className={`border-b border-borderSoft px-2 py-2.5 text-center text-xs font-semibold ${
                    day.getUTCDay() === 0 || day.getUTCDay() === 6 ? 'bg-grayCard text-hintText' : 'text-mutedText'
                  }`}
                >
                  <div>{weekDayShort(day)}</div>
                  <div className="font-normal normal-case text-hintText">{frShort(day)}</div>
                </th>
              ))}
              <th className="border-b border-borderSoft px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-mutedText">Total</th>
              {canEdit && <th className="w-8 border-b border-borderSoft" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6 + days.length} className="px-4 py-10 text-center text-sm text-mutedText">
                  Aucune ligne. Ajoutez une ligne pour commencer.
                </td>
              </tr>
            )}

            {rows.map((row, rowIndex) => {
              const rowTotal = days.reduce((sum, day) => sum + (row.hoursMap[dateKey(day)] ?? 0), 0);
              const siteOptions = sitesForRow(row);
              const taskTypeOptions = activeTaskTypes.some((taskType) => taskType.value === row.activity)
                ? activeTaskTypes
                : [...activeTaskTypes, ...taskTypes.filter((taskType) => taskType.value === row.activity)];

              return (
                <tr key={rowIndex} className="group border-b border-borderSoft hover:bg-surfaceHover">
                  <td className="min-w-[190px] px-3 py-2">
                    {canEdit ? (
                      <select
                        className="w-full rounded border border-borderSoft bg-white px-2 py-1 text-xs outline-none focus:border-accent"
                        value={row.projectId}
                        onChange={(event) => setProject(rowIndex, event.target.value)}
                      >
                        <option value="">Projet</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.code} - {project.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-mutedText">{row.projectId ? projects.find((p) => p.id === row.projectId)?.name : '-'}</span>
                    )}
                  </td>

                  <td className="min-w-[190px] px-3 py-2">
                    {canEdit ? (
                      <select
                        className="w-full rounded border border-borderSoft bg-white px-2 py-1 text-xs outline-none focus:border-accent"
                        value={row.siteId}
                        onChange={(event) => setSite(rowIndex, event.target.value)}
                      >
                        <option value="">Chantier</option>
                        {siteOptions.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.code} - {site.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-mutedText">{row.placeOfWork || '-'}</span>
                    )}
                  </td>

                  <td className="min-w-[160px] px-3 py-2">
                    {canEdit ? (
                      <select
                        className="w-full rounded border border-borderSoft bg-white px-2 py-1 text-xs outline-none focus:border-accent"
                        value={row.activity}
                        onChange={(event) => patchRow(rowIndex, { activity: event.target.value })}
                      >
                        {taskTypeOptions.map((taskType) => (
                          <option key={taskType.value} value={taskType.value}>
                            {taskType.isActive ? taskType.label : `${taskType.label} (inactif)`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-mutedText">{taskTypeLabels[row.activity] ?? row.activity}</span>
                    )}
                  </td>

                  <td className="min-w-[220px] px-3 py-2">
                    {canEdit ? (
                      <input
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-bodyText outline-none focus:border-accent focus:bg-white"
                        value={row.taskName}
                        placeholder="Description manuelle"
                        onChange={(event) => patchRow(rowIndex, { taskName: event.target.value })}
                      />
                    ) : (
                      <span className="font-medium text-bodyText">{row.taskName || '-'}</span>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {canEdit ? (
                      <select
                        className="rounded border border-borderSoft bg-white px-2 py-1 text-xs outline-none focus:border-accent"
                        value={row.billingType}
                        onChange={(event) => patchRow(rowIndex, { billingType: event.target.value })}
                      >
                        <option value="BILLABLE">Facturable</option>
                        <option value="NON_BILLABLE">Non fact.</option>
                      </select>
                    ) : (
                      <span className="text-xs text-mutedText">{billingLabels[row.billingType] ?? row.billingType}</span>
                    )}
                    <div className="mt-1 text-[11px] text-hintText">{locationLabels[row.workLocation] ?? row.workLocation}</div>
                  </td>

                  {days.map((day) => {
                    const hours = row.hoursMap[dateKey(day)] ?? 0;
                    const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                    return (
                      <td key={dateKey(day)} className={`px-1 py-2 text-center ${isWeekend ? 'bg-grayCard/40' : ''}`}>
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step={0.5}
                            className={`w-12 rounded border text-center text-sm outline-none focus:border-accent focus:bg-white ${
                              hours > 0
                                ? 'border-accent/30 bg-accentLight/60 font-medium text-accentText'
                                : 'border-transparent bg-transparent text-hintText'
                            }`}
                            value={hours || ''}
                            placeholder="0"
                            onChange={(event) => setHours(rowIndex, day, event.target.value)}
                          />
                        ) : (
                          <span className={hours > 0 ? 'font-medium text-bodyText' : 'text-hintText'}>
                            {hours > 0 ? `${hours}h` : '-'}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 text-right font-semibold text-bodyText">{rowTotal > 0 ? `${rowTotal}h` : '-'}</td>
                  {canEdit && (
                    <td className="px-2 py-2 text-center opacity-0 group-hover:opacity-100">
                      <button type="button" onClick={() => removeRow(rowIndex)} className="text-mutedText hover:text-dangerText" title="Supprimer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            <tr className="bg-accentLight/30">
              <td className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-accentText" colSpan={5}>
                Total {grandTotal > 0 ? `- ${grandTotal}h` : ''}
              </td>
              {days.map((day, index) => {
                const total = totalByDay[index] ?? 0;
                return (
                  <td key={dateKey(day)} className="px-1 py-3 text-center text-sm font-bold text-bodyText">
                    {total > 0 ? `${total}h` : '-'}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-right text-sm font-bold text-accent">{grandTotal > 0 ? `${grandTotal}h` : '-'}</td>
              {canEdit && <td />}
            </tr>
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="border-t border-borderSoft p-4">
          <GhostButton type="button" onClick={addRow}>
            <Plus className="h-4 w-4" /> Ajouter une ligne
          </GhostButton>
        </div>
      )}
    </section>
  );
}
