'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Database, Loader2, PauseCircle, PlayCircle, UserPlus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DataTable } from '@/components/ui/data-table';
import { FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

const fallback = [
  {
    id: 'tenant-futura',
    name: 'Futura Expertise',
    slug: 'futura-expertise',
    status: 'ACTIVE',
    subscriptionPlan: { name: 'Enterprise' },
    users: [
      {
        id: 'rm-futura',
        firstName: 'Abdelouahed',
        lastName: 'El Youssefi',
        email: 'A.elyoussefi@futura-expert.com',
        status: 'ACTIVE',
      },
    ],
    _count: { users: 6, sites: 5 },
  },
];

type Tenant = (typeof fallback)[number];
type ReactivationStatus = 'ACTIVE' | 'TRIAL';

const emptyManagerForm = {
  tenantId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
};

function resourceManagerLabel(tenant: Tenant) {
  const managers = tenant.users ?? [];
  if (!managers.length) return 'A designer';
  return managers.map((manager) => `${manager.firstName} ${manager.lastName}`.trim() || manager.email).join(', ');
}

function CreateResourceManagerModal({ tenants, onCreated }: { tenants: Tenant[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyManagerForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(key: keyof typeof emptyManagerForm, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.tenantId || !form.firstName || !form.lastName || !form.email || !form.password) {
      setError('Choisissez une societe et renseignez le nom, email et mot de passe initial.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createUser({
        tenantId: form.tenantId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        role: 'RESOURCE_MANAGER',
        status: 'ACTIVE',
      });
      setOpen(false);
      setForm(emptyManagerForm);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setForm(emptyManagerForm); setError(null); } }}>
      <Dialog.Trigger asChild>
        <PrimaryButton type="button">
          <UserPlus className="h-4 w-4" /> Resource Manager
        </PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Nouveau Resource Manager</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-5">
            <SelectField label="Societe / base tenant" value={form.tenantId} onChange={(event) => patch('tenantId', event.target.value)}>
              <option value="">Choisir une societe</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} - {tenant.slug}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Prenom" value={form.firstName} onChange={(event) => patch('firstName', event.target.value)} />
              <FormField label="Nom" value={form.lastName} onChange={(event) => patch('lastName', event.target.value)} />
              <FormField label="Email" type="email" value={form.email} onChange={(event) => patch('email', event.target.value)} />
              <FormField label="Telephone" value={form.phone} onChange={(event) => patch('phone', event.target.value)} />
              <FormField label="Mot de passe initial" value={form.password} onChange={(event) => patch('password', event.target.value)} />
            </div>
            {error && <p className="text-sm text-dangerText">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Creer
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

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
    {
      header: 'Base tenant',
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="inline-flex items-center gap-1 text-sm font-medium text-bodyText">
            <Database className="h-3.5 w-3.5 text-accent" /> {row.original.slug}
          </span>
          <span className="text-xs text-mutedText">Espace donnees isole</span>
        </div>
      ),
    },
    { header: 'Abonnement',    cell: ({ row }) => row.original.subscriptionPlan?.name ?? '—' },
    { header: 'Resource Manager', cell: ({ row }) => resourceManagerLabel(row.original) },
    { header: 'Utilisateurs',  cell: ({ row }) => row.original._count.users },
    { header: 'Sites',     cell: ({ row }) => row.original._count.sites },
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
          description="Gestion des tenants, abonnements et acces plateforme. Chaque societe travaille dans son espace de donnees isole."
          actions={<CreateResourceManagerModal tenants={data} onCreated={refresh} />}
        />
        <div className="rounded-xl border border-accent/20 bg-accentLight/40 px-4 py-3 text-sm text-accentText">
          L'isolation est appliquee par tenant : utilisateurs, projets, sites, timesheets, congés et exports restent rattaches a la base tenant de leur societe.
        </div>
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
