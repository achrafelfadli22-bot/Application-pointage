'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Ban, Check, X } from 'lucide-react';
import { BookingModal } from '@/components/domain/booking-modal';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SummaryCounters } from '@/components/ui/cards';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { demoLeaveRequests } from '@/lib/demo-data';
import { useApiData } from '@/lib/use-api-data';

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  updatedAt: string;
  leaveType: { name: string };
  user: { id: string; firstName: string; lastName: string };
};

export default function TimeOffRequestsPage() {
  const { data, refresh } = useApiData<LeaveRequest[]>(
    () => api.leaveRequests() as Promise<LeaveRequest[]>,
    demoLeaveRequests as LeaveRequest[],
  );

  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const myRole   = tokenStore.session?.role ?? '';
  const myUserId = tokenStore.session?.user?.id ?? '';
  const isApprover  = ['RESOURCE_MANAGER', 'HR', 'PROJECT_MANAGER', 'MANAGER'].includes(myRole);
  const isReadOnly  = false;

  async function handleApprove(id: string) {
    try { await api.approveLeaveRequest(id); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleReject(id: string) {
    try { await api.rejectLeaveRequest(id, 'Refusé par le gestionnaire'); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleCancel(id: string) {
    try { await api.cancelLeaveRequest(id); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  const filtered = statusFilter ? data.filter((r) => r.status === statusFilter) : data;

  const columns: ColumnDef<LeaveRequest, unknown>[] = [
    { header: 'Employé',    cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}` },
    { header: 'Type',       cell: ({ row }) => row.original.leaveType.name },
    { header: 'Début',      cell: ({ row }) => new Date(row.original.startDate).toLocaleDateString('fr-FR') },
    { header: 'Fin',        cell: ({ row }) => new Date(row.original.endDate).toLocaleDateString('fr-FR') },
    { header: 'Durée',      cell: ({ row }) => `${row.original.durationDays} j` },
    { header: 'Statut',     cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: 'Mis à jour', cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString('fr-FR') },
    {
      header: 'Actions',
      cell: ({ row }) => {
        const req = row.original;
        if (isReadOnly) return null;

        const isOwn     = req.user.id === myUserId;
        const canApproveReject = isApprover && req.status === 'SUBMITTED';
        // Annulation : approbateur sur SUBMITTED, ou propriétaire sur DRAFT/SUBMITTED
        const canCancel = (isOwn && (req.status === 'DRAFT' || req.status === 'SUBMITTED'))
                       || (isApprover && req.status === 'SUBMITTED');

        if (!canApproveReject && !canCancel) return null;

        return (
          <div className="flex gap-1.5">
            {canApproveReject && (
              <>
                <ConfirmDialog
                  title="Approuver la demande"
                  description={`Approuver la demande de congé de ${req.user.firstName} ${req.user.lastName} ?`}
                  confirmLabel="Approuver"
                  onConfirm={() => handleApprove(req.id)}
                  trigger={
                    <button type="button" title="Approuver" className="flex h-7 w-7 items-center justify-center rounded-md text-successText hover:bg-successBg">
                      <Check className="h-4 w-4" />
                    </button>
                  }
                />
                <ConfirmDialog
                  title="Refuser la demande"
                  description={`Refuser la demande de congé de ${req.user.firstName} ${req.user.lastName} ?`}
                  confirmLabel="Refuser"
                  onConfirm={() => handleReject(req.id)}
                  trigger={
                    <button type="button" title="Refuser" className="flex h-7 w-7 items-center justify-center rounded-md text-dangerText hover:bg-dangerBg">
                      <X className="h-4 w-4" />
                    </button>
                  }
                />
              </>
            )}
            {canCancel && (
              <ConfirmDialog
                title="Annuler la demande"
                description={`Annuler la demande de congé de ${req.user.firstName} ${req.user.lastName} ? Le solde sera restitué.`}
                confirmLabel="Annuler la demande"
                onConfirm={() => handleCancel(req.id)}
                trigger={
                  <button type="button" title="Annuler" className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-dangerBg hover:text-dangerText">
                    <Ban className="h-4 w-4" />
                  </button>
                }
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Demandes de congé"
          description={isReadOnly ? 'Consultation des congés de votre équipe (lecture seule).' : 'Suivi et validation des demandes de congé.'}
          actions={isReadOnly ? undefined : <BookingModal />}
        />

        {actionError && (
          <div className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
            {actionError}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-52">
            <SelectField
              label="Filtrer par statut"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tous les statuts</option>
              <option value="DRAFT">Brouillon</option>
              <option value="SUBMITTED">En attente</option>
              <option value="APPROVED">Approuvé</option>
              <option value="REJECTED">Refusé</option>
              <option value="CANCELLED">Annulé</option>
            </SelectField>
          </div>
        </div>

        <SummaryCounters
          items={[
            { label: 'Toutes',      value: data.length,                                                active: !statusFilter },
            { label: 'En attente',  value: data.filter((r) => r.status === 'SUBMITTED').length },
            { label: 'Approuvées',  value: data.filter((r) => r.status === 'APPROVED').length },
            { label: 'Refusées',    value: data.filter((r) => r.status === 'REJECTED').length },
          ]}
        />

        <DataTable columns={columns} data={filtered} />
      </div>
    </AppShell>
  );
}
