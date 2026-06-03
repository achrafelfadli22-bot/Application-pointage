'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

const fallback = [
  { id: 'tenant-a', name: 'Société Alpha BTP',          slug: 'societe-alpha-btp',          status: 'ACTIVE', subscriptionPlan: { name: 'Pro' },   _count: { users: 19, sites: 3 } },
  { id: 'tenant-b', name: 'Société Atlas Construction', slug: 'societe-atlas-construction', status: 'TRIAL',  subscriptionPlan: { name: 'Essai' }, _count: { users: 2,  sites: 2 } },
];

type Tenant = (typeof fallback)[number];
type ReactivationStatus = 'ACTIVE' | 'TRIAL';

export default function AdminTenantsPage() {
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, refresh } = useApiData<Tenant[]>(() => api.tenants() as Promise<Tenant[]>, fallback);

  async function handleSuspend(id: string) {
    try { await api.suspendTenant(id); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  async function handleReactivate(id: string, status: ReactivationStatus) {
    try { await api.reactivateTenant(id, status); refresh(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Erreur'); }
  }

  const columns: ColumnDef<Tenant, unknown>[] = [
    { header: 'Société',       accessorKey: 'name' },
    { header: 'Identifiant',   accessorKey: 'slug' },
    { header: 'Abonnement',    cell: ({ row }) => row.original.subscriptionPlan?.name ?? '—' },
    { header: 'Utilisateurs',  cell: ({ row }) => row.original._count.users },
    { header: 'Chantiers',     cell: ({ row }) => row.original._count.sites },
    { header: 'Statut',        cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          {(row.original.status === 'ACTIVE' || row.original.status === 'TRIAL') && (
            <ConfirmDialog
              title="Suspendre la société"
              description={`Suspendre l'accès à « ${row.original.name} » ? Tous les utilisateurs seront bloqués immédiatement.`}
              confirmLabel="Suspendre"
              onConfirm={() => handleSuspend(row.original.id)}
              trigger={
                <button type="button" title="Suspendre" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-dangerText hover:bg-dangerBg">
                  <PauseCircle className="h-3.5 w-3.5" /> Suspendre
                </button>
              }
            />
          )}
          {row.original.status === 'SUSPENDED' && (
            <>
              <ConfirmDialog
                title="Réactiver en actif"
                description={`Réactiver l'accès à « ${row.original.name} » en statut actif ? Les utilisateurs pourront se reconnecter immédiatement.`}
                confirmLabel="Activer"
                onConfirm={() => handleReactivate(row.original.id, 'ACTIVE')}
                trigger={
                  <button type="button" title="Réactiver en actif" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-successText hover:bg-successBg">
                    <PlayCircle className="h-3.5 w-3.5" /> Actif
                  </button>
                }
              />
              <ConfirmDialog
                title="Réactiver en essai"
                description={`Réactiver l'accès à « ${row.original.name} » en statut essai ? Le compte restera en période d'essai.`}
                confirmLabel="Mettre en essai"
                onConfirm={() => handleReactivate(row.original.id, 'TRIAL')}
                trigger={
                  <button type="button" title="Réactiver en essai" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-warningText hover:bg-warningBg">
                    <PlayCircle className="h-3.5 w-3.5" /> Essai
                  </button>
                }
              />
            </>
          )}
          {row.original.status !== 'ACTIVE' && row.original.status !== 'TRIAL' && row.original.status !== 'SUSPENDED' && (
            <span className="text-xs text-mutedText">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Administration — Sociétés"
          description="Gestion des tenants, abonnements et accès plateforme."
        />
        {actionError && (
          <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
            {actionError}
          </div>
        )}
        <DataTable columns={columns} data={data} />
      </div>
    </AppShell>
  );
}
