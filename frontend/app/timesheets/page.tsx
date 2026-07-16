'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SummaryCounters } from '@/components/ui/cards';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DateField, SelectField } from '@/components/ui/form-fields';
import { ErrorState } from '@/components/ui/states';
import { api, tokenStore } from '@/lib/api-client';
import { demoTimesheets } from '@/lib/demo-data';
import { useApiData } from '@/lib/use-api-data';

type Timesheet = Omit<(typeof demoTimesheets)[number], 'user'> & {
  user: { id?: string; firstName: string; lastName: string; email?: string };
};
type TimesheetStatusFilter = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'N1_APPROVED' | 'APPROVED' | 'REJECTED';
type Employee = {
  id: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
};
type TimesheetSettings = { timesheetPeriod: 'WEEKLY' | 'MONTHLY'; timesheetPeriodDays: number };

// ─── Modal Nouvelle Timesheet ─────────────────────────────────────────────────

function NewTimesheetModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [customPeriod, setCustomPeriod] = useState(false);
  const [userId, setUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myRole = tokenStore.session?.role ?? '';
  const canChooseOwner = ['RESOURCE_MANAGER', 'HR', 'PROJECT_MANAGER', 'MANAGER'].includes(myRole);
  const { data: employees } = useApiData<Employee[]>(
    () => (canChooseOwner ? (api.employees() as Promise<Employee[]>) : Promise.resolve([])),
    [],
  );
  const { data: timesheetSettings } = useApiData<TimesheetSettings>(
    () => api.settingsTimesheet() as Promise<TimesheetSettings>,
    { timesheetPeriod: 'WEEKLY', timesheetPeriodDays: 7 },
  );
  const isMonthly = timesheetSettings.timesheetPeriod === 'MONTHLY';
  const periodLabel = isMonthly ? 'Mensuelle (mois calendaire)' : 'Hebdomadaire (7 j)';

  /**
   * Calcule la date de fin selon la périodicité :
   * - WEEKLY  : start + 6 jours (semaine complète)
   * - MONTHLY : dernier jour du mois de la date de début (respecte le calendrier réel)
   */
  function computeEndDate(startIso: string): string {
    const d = new Date(startIso);
    if (isMonthly) {
      // Dernier jour du mois calendaire : on passe au 1er du mois suivant et on recule d'un jour
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
    }
    // Hebdomadaire : start + 6 jours
    const end = new Date(d);
    end.setUTCDate(d.getUTCDate() + 6);
    return end.toISOString().slice(0, 10);
  }

  function handleStartChange(val: string) {
    setPeriodStart(val);
    if (val && !customPeriod) {
      setPeriodEnd(computeEndDate(val));
    }
  }

  function handleCustomPeriodChange(enabled: boolean) {
    setCustomPeriod(enabled);
    if (!enabled && periodStart) {
      setPeriodEnd(computeEndDate(periodStart));
    }
  }

  async function handleSubmit() {
    if (!periodStart || !periodEnd) { setError('Les deux dates sont requises.'); return; }
    if (new Date(periodEnd) < new Date(periodStart)) { setError('La date de fin doit être après la date de début.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.createTimesheet({ periodStart, periodEnd, ...(userId ? { userId } : {}) });
      setOpen(false);
      setPeriodStart(''); setPeriodEnd(''); setUserId(''); setCustomPeriod(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <PrimaryButton type="button">
          <Plus className="h-4 w-4" /> Nouvelle feuille de temps
        </PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Nouvelle feuille de temps</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover hover:text-bodyText">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-5">
            {canChooseOwner && (
              <SelectField label="Ressource" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Moi-meme</option>
                {employees.map((employee) => (
                  <option key={employee.user.id} value={employee.user.id}>
                    {employee.user.firstName} {employee.user.lastName}
                  </option>
                ))}
              </SelectField>
            )}
            <div className="rounded-md border border-borderSoft bg-surfaceHover px-3 py-2 text-xs text-mutedText">
              Périodicité configurée : <span className="font-semibold text-bodyText">{periodLabel}</span>
            </div>
            <DateField label="Date de début" value={periodStart} onChange={(e) => handleStartChange(e.target.value)} />
            <DateField
              label="Date de fin"
              value={periodEnd}
              disabled={!customPeriod}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
            <label className="flex items-start gap-2 rounded-md border border-borderSoft bg-surfaceHover px-3 py-2 text-xs text-mutedText">
              <input
                type="checkbox"
                checked={customPeriod}
                onChange={(e) => handleCustomPeriodChange(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Période personnalisée. Sinon, la date de fin est calculée automatiquement selon les réglages de l'entreprise.
              </span>
            </label>
            {error && <p className="text-sm text-dangerText">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Création…' : 'Créer'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TimesheetStatusFilter>('ALL');
  const { data, error: loadError, refresh } = useApiData<Timesheet[]>(() => api.timesheets() as Promise<Timesheet[]>, demoTimesheets);

  // Timesheets validees par N+1/N+2 ou HR.
  const myRole    = tokenStore.session?.role ?? '';
  const myUserId  = tokenStore.session?.user?.id ?? '';
  // HR est en lecture seule — ne peut pas créer de timesheet
  const canCreate = ['RESOURCE_MANAGER', 'PROJECT_MANAGER', 'MANAGER', 'EMPLOYEE'].includes(myRole);


  async function handleDelete(id: string) {
    try { await api.deleteTimesheet(id); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  const filteredData = statusFilter === 'ALL' ? data : data.filter((timesheet) => timesheet.status === statusFilter);

  const columns: ColumnDef<Timesheet, unknown>[] = [
    { header: 'Employé',     cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}` },
    { header: 'Période',     cell: ({ row }) => `${new Date(row.original.periodStart).toLocaleDateString('fr-FR')} – ${new Date(row.original.periodEnd).toLocaleDateString('fr-FR')}` },
    { header: 'Statut',      cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: 'Soumis le',   cell: ({ row }) => row.original.submittedAt ? new Date(row.original.submittedAt).toLocaleDateString('fr-FR') : '—' },
    { header: 'Approuvé le', cell: ({ row }) => row.original.approvedAt ? new Date(row.original.approvedAt).toLocaleDateString('fr-FR') : '—' },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link href={`/timesheets/${row.original.id}`} className="text-sm font-medium text-accent hover:underline">
            Ouvrir
          </Link>
          {row.original.status === 'DRAFT' && row.original.user.id === myUserId && (
            <ConfirmDialog
              title="Supprimer la feuille de temps"
              description="Cette feuille de temps en brouillon sera supprimee definitivement."
              confirmLabel="Supprimer"
              onConfirm={() => handleDelete(row.original.id)}
              trigger={
                <button type="button" title="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-md text-dangerText hover:bg-dangerBg">
                  <Trash2 className="h-4 w-4" />
                </button>
              }
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Feuilles de temps"
          description="Saisie, soumission et validation des feuilles de temps."
          actions={canCreate ? <NewTimesheetModal onCreated={refresh} /> : undefined}
        />

        {actionError && (
          <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
            {actionError}
          </div>
        )}
        {loadError && <ErrorState message={`Erreur de chargement des feuilles de temps : ${loadError}`} />}

        <SummaryCounters
          items={[
            { label: 'Toutes',      value: data.length,                                              active: statusFilter === 'ALL',       onClick: () => setStatusFilter('ALL') },
            { label: 'Brouillon',   value: data.filter((t) => t.status === 'DRAFT').length,          active: statusFilter === 'DRAFT',     onClick: () => setStatusFilter('DRAFT') },
            { label: 'En attente',  value: data.filter((t) => t.status === 'SUBMITTED').length,      active: statusFilter === 'SUBMITTED', onClick: () => setStatusFilter('SUBMITTED') },
            { label: 'Pre-approuvees', value: data.filter((t) => t.status === 'N1_APPROVED').length,    active: statusFilter === 'N1_APPROVED', onClick: () => setStatusFilter('N1_APPROVED') },
            { label: 'Approuvées',  value: data.filter((t) => t.status === 'APPROVED').length,       active: statusFilter === 'APPROVED',  onClick: () => setStatusFilter('APPROVED') },
            { label: 'Refusées',    value: data.filter((t) => t.status === 'REJECTED').length,       active: statusFilter === 'REJECTED',  onClick: () => setStatusFilter('REJECTED') },
          ]}
        />

        <DataTable columns={columns} data={filteredData} />
      </div>
    </AppShell>
  );
}
