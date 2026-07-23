'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, ExternalLink, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SummaryCounters } from '@/components/ui/cards';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api-client';
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
  approvalPermissions?: { canApproveReject: boolean };
  attachmentUrl?: string | null;
  comment?: string | null;
};

export default function TimeOffRequestsPage() {
  const { data, refresh } = useApiData<LeaveRequest[]>(
    () => api.leaveRequests('managed') as Promise<LeaveRequest[]>,
    [],
    { fallbackMode: 'never' },
  );

  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  async function handleApprove(id: string) {
    try { await api.approveLeaveRequest(id); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleReject(id: string) {
    try { await api.rejectLeaveRequest(id, 'Refusé par le gestionnaire'); refresh(); }
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
    /* Actions déplacées dans le dialogue de détails.
    {
      header: 'Actions',
      cell: ({ row }) => {
        const req = row.original;
        if (isReadOnly) return null;

        const isOwn     = req.user.id === myUserId;
        const canApproveReject =
          (myRole === 'PROJECT_MANAGER' && req.status === 'SUBMITTED') ||
          (myRole === 'RESOURCE_MANAGER' && req.status === 'N1_APPROVED');
        // Annulation : approbateur sur SUBMITTED, ou propriétaire sur DRAFT/SUBMITTED
        const canCancel = isOwn && (req.status === 'DRAFT' || req.status === 'SUBMITTED');

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
    */
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Demandes de congé"
          description="Consultez et validez uniquement les demandes de congé des autres employés."
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
              <option value="N1_APPROVED">Validé par le chef de projet</option>
              <option value="APPROVED">Approuvé</option>
              <option value="REJECTED">Refusé</option>
              <option value="CANCELLED">Annulé</option>
            </SelectField>
          </div>
        </div>

        <SummaryCounters
          items={[
            { label: 'Toutes',      value: data.length,                                                active: !statusFilter },
            { label: 'En attente',  value: data.filter((r) => r.status === 'SUBMITTED' || r.status === 'N1_APPROVED').length },
            { label: 'Approuvées',  value: data.filter((r) => r.status === 'APPROVED').length },
            { label: 'Refusées',    value: data.filter((r) => r.status === 'REJECTED').length },
          ]}
        />

        <DataTable columns={columns} data={filtered} onRowClick={setSelectedRequest} />

        <Dialog.Root open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
              {selectedRequest && (
                <>
                  <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
                    <Dialog.Title className="text-base font-semibold text-bodyText">Détails de la demande de congé</Dialog.Title>
                    <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
                      <X className="h-4 w-4" />
                    </Dialog.Close>
                  </div>

                  <div className="grid gap-4 p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Detail label="Employé" value={`${selectedRequest.user.firstName} ${selectedRequest.user.lastName}`} />
                      <Detail label="Type" value={selectedRequest.leaveType.name} />
                      <Detail label="Date de début" value={new Date(selectedRequest.startDate).toLocaleDateString('fr-FR')} />
                      <Detail label="Date de fin" value={new Date(selectedRequest.endDate).toLocaleDateString('fr-FR')} />
                      <Detail label="Durée" value={`${selectedRequest.durationDays} j`} />
                      <div>
                        <div className="text-xs font-semibold uppercase text-mutedText">Statut</div>
                        <div className="mt-1"><StatusBadge status={selectedRequest.status} /></div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-borderSoft bg-grayCard p-4">
                      <div className="text-xs font-semibold uppercase text-mutedText">Commentaire du demandeur</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-bodyText">
                        {selectedRequest.comment?.trim() || 'Aucun commentaire.'}
                      </div>
                    </div>

                    <div className="rounded-lg border border-borderSoft bg-grayCard p-4">
                      <div className="text-xs font-semibold uppercase text-mutedText">Justificatif</div>
                      {selectedRequest.attachmentUrl ? (
                        <a
                          href={selectedRequest.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                        >
                          Voir le justificatif
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        <div className="mt-2 text-sm text-mutedText">Aucun justificatif joint.</div>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-borderSoft pt-4">
                      {selectedRequest.approvalPermissions?.canApproveReject && (
                        <>
                          <ConfirmDialog
                            title="Refuser la demande"
                            description={`Refuser la demande de ${selectedRequest.user.firstName} ${selectedRequest.user.lastName} ?`}
                            confirmLabel="Refuser"
                            onConfirm={async () => { await handleReject(selectedRequest.id); setSelectedRequest(null); }}
                            trigger={<button type="button" className="inline-flex h-9 items-center gap-2 rounded-md border border-dangerBorder px-3 text-sm font-semibold text-dangerText hover:bg-dangerBg"><X className="h-4 w-4" /> Refuser</button>}
                          />
                          <ConfirmDialog
                            title="Approuver la demande"
                            description={`Approuver la demande de ${selectedRequest.user.firstName} ${selectedRequest.user.lastName} ?`}
                            confirmLabel="Approuver"
                            onConfirm={async () => { await handleApprove(selectedRequest.id); setSelectedRequest(null); }}
                            trigger={<button type="button" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:opacity-90"><Check className="h-4 w-4" /> Approuver</button>}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-mutedText">{label}</div>
      <div className="mt-1 font-semibold text-bodyText">{value}</div>
    </div>
  );
}
