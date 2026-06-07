'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Check, Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SummaryCounters } from '@/components/ui/cards';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DateField, SelectField } from '@/components/ui/form-fields';
import { api, tokenStore } from '@/lib/api-client';
import { demoTimesheets } from '@/lib/demo-data';
import { useApiData } from '@/lib/use-api-data';

type Timesheet = (typeof demoTimesheets)[number];
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
  const periodDays = timesheetSettings.timesheetPeriod === 'MONTHLY' ? 30 : 7;
  const periodLabel = timesheetSettings.timesheetPeriod === 'MONTHLY' ? 'Mensuelle (30 j)' : 'Hebdomadaire (7 j)';

  // Auto-fill the tenant-configured period when start is set.
  function handleStartChange(val: string) {
    setPeriodStart(val);
    if (val) {
      const d = new Date(val);
      d.setUTCDate(d.getUTCDate() + periodDays - 1);
      setPeriodEnd(d.toISOString().slice(0, 10));
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
      setPeriodStart(''); setPeriodEnd(''); setUserId('');
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
          <Plus className="h-4 w-4" /> Nouvelle timesheet
        </PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Nouvelle timesheet</Dialog.Title>
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
            <DateField label="Date de fin" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
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
  const { data, refresh } = useApiData<Timesheet[]>(() => api.timesheets() as Promise<Timesheet[]>, demoTimesheets);

  // Timesheets validees par N+1/N+2 ou HR.
  const myRole    = tokenStore.session?.role ?? '';
  const canManage = ['HR', 'PROJECT_MANAGER', 'MANAGER'].includes(myRole);
  // HR est en lecture seule — ne peut pas créer de timesheet
  const canCreate = ['RESOURCE_MANAGER', 'PROJECT_MANAGER', 'MANAGER', 'EMPLOYEE'].includes(myRole);

  async function handleApprove(id: string) {
    try { await api.approveTimesheet(id); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }
  async function handleReject(id: string) {
    try { await api.rejectTimesheet(id, 'Refusé par le gestionnaire'); refresh(); }
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
          {canManage && ['SUBMITTED', 'N1_APPROVED'].includes(row.original.status) && (
            <>
              <ConfirmDialog
                title="Approuver la timesheet"
                description={`Approuver la timesheet de ${row.original.user.firstName} ${row.original.user.lastName} ?`}
                confirmLabel="Approuver"
                onConfirm={() => handleApprove(row.original.id)}
                trigger={
                  <button type="button" title="Approuver" className="flex h-7 w-7 items-center justify-center rounded-md text-successText hover:bg-successBg">
                    <Check className="h-4 w-4" />
                  </button>
                }
              />
              <ConfirmDialog
                title="Refuser la timesheet"
                description={`Refuser la timesheet de ${row.original.user.firstName} ${row.original.user.lastName} ?`}
                confirmLabel="Refuser"
                onConfirm={() => handleReject(row.original.id)}
                trigger={
                  <button type="button" title="Refuser" className="flex h-7 w-7 items-center justify-center rounded-md text-dangerText hover:bg-dangerBg">
                    <X className="h-4 w-4" />
                  </button>
                }
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Timesheets"
          description="Saisie, soumission et validation des feuilles de temps."
          actions={canCreate ? <NewTimesheetModal onCreated={refresh} /> : undefined}
        />

        {actionError && (
          <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
            {actionError}
          </div>
        )}

        <SummaryCounters
          items={[
            { label: 'Toutes',      value: data.length,                                              active: statusFilter === 'ALL',       onClick: () => setStatusFilter('ALL') },
            { label: 'Brouillon',   value: data.filter((t) => t.status === 'DRAFT').length,          active: statusFilter === 'DRAFT',     onClick: () => setStatusFilter('DRAFT') },
            { label: 'En attente',  value: data.filter((t) => t.status === 'SUBMITTED').length,      active: statusFilter === 'SUBMITTED', onClick: () => setStatusFilter('SUBMITTED') },
            { label: 'Validees N+1', value: data.filter((t) => t.status === 'N1_APPROVED').length,    active: statusFilter === 'N1_APPROVED', onClick: () => setStatusFilter('N1_APPROVED') },
            { label: 'Approuvées',  value: data.filter((t) => t.status === 'APPROVED').length,       active: statusFilter === 'APPROVED',  onClick: () => setStatusFilter('APPROVED') },
            { label: 'Refusées',    value: data.filter((t) => t.status === 'REJECTED').length,       active: statusFilter === 'REJECTED',  onClick: () => setStatusFilter('REJECTED') },
          ]}
        />

        <DataTable columns={columns} data={filteredData} />
      </div>
    </AppShell>
  );
}
