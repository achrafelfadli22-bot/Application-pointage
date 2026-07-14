'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { SelectField, FormField, DateField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-items';
import { useApiData } from '@/lib/use-api-data';
import { CsvImportModal } from '@/components/domain/csv-import-modal';

type TeamSite = { id: string; code: string; name: string; city?: string | null };

type Employee = {
  id: string;
  employeeNumber: string;
  jobTitle: string;
  annualLeaveBalance: number;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    role: string;
    status: string;
    managedSites?: TeamSite[];
    siteAssignments?: Array<{ site: TeamSite }>;
  };
  mainSite?: TeamSite | null;
};

type SiteOptions = { jobTitleOptions?: string[] };

const fallbackJobTitleOptions = [
  'Ressource Manager',
  'Chef de projet',
  'Chef de site',
  'Ingenieur d etude',
  'Technicien d etude',
  'Technicien',
  'Electricien',
  'Administratif',
];

// ─── Modal Nouvel Employé ────────────────────────────────────────────────────

const emptyForm = {
  firstName: '', lastName: '', email: '',
  phone: '', role: 'EMPLOYEE', employeeNumber: '', jobTitle: '',
  contractType: 'CDI', hireDate: '', annualLeaveBalance: 18, hourlyRate: 85,
};

function NewEmployeeModal({ jobTitleOptions, onCreated }: { jobTitleOptions: string[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function f(key: keyof typeof emptyForm, label: string, type = 'text') {
    return (
      <FormField
        label={label}
        type={type}
        value={String(form[key])}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            [key]: type === 'number' ? Number(e.target.value) : e.target.value,
          }))
        }
      />
    );
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email || !form.employeeNumber || !form.jobTitle || !form.hireDate) {
      setError('Champs obligatoires : prénom, nom, email, matricule, date d\'embauche.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createEmployee(form as unknown as Record<string, unknown>);
      setOpen(false);
      setForm(emptyForm);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setError(null); } }}>
      <Dialog.Trigger asChild>
        <PrimaryButton type="button"><Plus className="h-4 w-4" /> Nouvel employé</PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(680px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Nouvel employé</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              {f('firstName',      'Prénom')}
              {f('lastName',       'Nom')}
              {f('email',          'Email',   'email')}
              {f('phone',          'Téléphone')}
              {f('employeeNumber', 'Matricule')}
              <SelectField
                label="Poste"
                value={form.jobTitle}
                onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
              >
                <option value="">Choisir un poste</option>
                {jobTitleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-bodyText">Rôle</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="EMPLOYEE">Employé</option>
                  <option value="MANAGER">Chef de site</option>
                  <option value="PROJECT_MANAGER">Chef de projet</option>
                  <option value="HR">RH</option>
                  <option value="RESOURCE_MANAGER">Ressource Manager</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-bodyText">Type de contrat</span>
                <select
                  value={form.contractType}
                  onChange={(e) => setForm((p) => ({ ...p, contractType: e.target.value }))}
                  className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERIM">Intérim</option>
                  <option value="FREELANCE">Freelance</option>
                </select>
              </label>
              <DateField label="Date d'embauche" value={form.hireDate} onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))} />
              {f('annualLeaveBalance', 'Solde congés annuel (jours)', 'number')}
              {f('hourlyRate',         'Taux horaire (MAD)',           'number')}
            </div>
            {error && <p className="text-sm text-dangerText">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Création…' : 'Créer l\'employé'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Site = TeamSite;

function relatedSiteIds(employee: Employee) {
  return new Set(
    [
      employee.mainSite?.id,
      ...(employee.user.managedSites ?? []).map((site) => site.id),
      ...(employee.user.siteAssignments ?? []).map((assignment) => assignment.site.id),
    ].filter(Boolean),
  );
}

function managedSitesLabel(employee: Employee) {
  const managedSites = employee.user.managedSites ?? [];
  if (!managedSites.length) return '—';
  return `${managedSites.length} - ${managedSites.map((site) => site.name).join(', ')}`;
}

export default function TeamPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const myRole = tokenStore.session?.role ?? '';
  const canManageEmployees = myRole === 'RESOURCE_MANAGER';
  const { data, refresh } = useApiData<Employee[]>(() => api.employees() as Promise<Employee[]>, []);
  const { data: sites } = useApiData<Site[]>(() => api.sites() as Promise<Site[]>, []);
  const { data: siteOptions } = useApiData<SiteOptions>(
    () => api.settingsSiteOptions() as Promise<SiteOptions>,
    { jobTitleOptions: fallbackJobTitleOptions },
  );

  const jobTitleOptions = Array.from(
    new Set(
      [...(siteOptions.jobTitleOptions?.length ? siteOptions.jobTitleOptions : fallbackJobTitleOptions), ...data.map((employee) => employee.jobTitle)]
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  );

  const filtered = data.filter((e) => {
    const q = search.toLowerCase();
    if (q && !`${e.user.firstName} ${e.user.lastName} ${e.user.email} ${e.employeeNumber}`.toLowerCase().includes(q)) return false;
    if (roleFilter && e.user.role !== roleFilter) return false;
    if (siteFilter && !relatedSiteIds(e).has(siteFilter)) return false;
    return true;
  });

  async function handleDelete(employee: Employee) {
    setActionError(null);
    try {
      await api.deleteEmployee(employee.id);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }

  const columns: ColumnDef<Employee, unknown>[] = [
    { header: 'Matricule',          accessorKey: 'employeeNumber' },
    { header: 'Nom complet',        cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}` },
    { header: 'Email',              cell: ({ row }) => row.original.user.email },
    { header: 'Poste',              accessorKey: 'jobTitle' },
    { header: 'Rôle',               cell: ({ row }) => ROLE_LABELS[row.original.user.role] ?? row.original.user.role },
    { header: 'Site principal', cell: ({ row }) => row.original.mainSite?.name ?? '—' },
    { header: 'Sites gérés',    cell: ({ row }) => managedSitesLabel(row.original) },
    { header: 'Statut',             cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: 'Solde congés',       cell: ({ row }) => `${row.original.annualLeaveBalance} j` },
    {
      header: 'Actions',
      cell: ({ row }) => {
        const canDelete = canManageEmployees && ['EMPLOYEE', 'MANAGER'].includes(row.original.user.role);

        return (
          <div className="flex items-center gap-2">
            <Link href={`/team/${row.original.id}`} className="text-sm font-medium text-accent hover:underline">
              Voir
            </Link>
            {canDelete && (
              <ConfirmDialog
                title="Supprimer la ressource"
                description={`Supprimer ${row.original.user.firstName} ${row.original.user.lastName} ? Le compte sera desactive et retire des affectations actives.`}
                confirmLabel="Supprimer"
                onConfirm={() => handleDelete(row.original)}
                trigger={
                  <button type="button" title="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-md text-dangerText hover:bg-dangerBg">
                    <Trash2 className="h-4 w-4" />
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
          title="Mon équipe"
          description="Employés, rôles, affectations site et statut RH."
          actions={canManageEmployees ? (
            <div className="flex items-center gap-2">
              <CsvImportModal onImported={refresh} />
              <NewEmployeeModal jobTitleOptions={jobTitleOptions} onCreated={refresh} />
            </div>
          ) : undefined}
        />

        {actionError && (
          <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
            {actionError}
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card md:grid-cols-3">
          <FormField
            label="Recherche"
            placeholder="Nom, email, matricule…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SelectField label="Rôle" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Tous les rôles</option>
            <option value="EMPLOYEE">Employé</option>
            <option value="MANAGER">Chef de site</option>
            <option value="PROJECT_MANAGER">Chef de projet</option>
            <option value="HR">RH</option>
            <option value="RESOURCE_MANAGER">Ressource Manager</option>
          </SelectField>
          <SelectField label="Site" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">Tous les sites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
            ))}
          </SelectField>
        </div>

        <DataTable columns={columns} data={filtered} />
      </div>
    </AppShell>
  );
}
