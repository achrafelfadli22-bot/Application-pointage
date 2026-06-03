'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DataTable } from '@/components/ui/data-table';
import { SelectField, FormField, DateField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api-client';
import { demoEmployees } from '@/lib/demo-data';
import { ROLE_LABELS } from '@/lib/nav-items';
import { useApiData } from '@/lib/use-api-data';
import { CsvImportModal } from '@/components/domain/csv-import-modal';

type Employee = (typeof demoEmployees)[number];

// ─── Modal Nouvel Employé ────────────────────────────────────────────────────

const emptyForm = {
  firstName: '', lastName: '', email: '', password: 'Password123!',
  phone: '', role: 'EMPLOYEE', employeeNumber: '', jobTitle: '',
  contractType: 'CDI', hireDate: '', annualLeaveBalance: 18, hourlyRate: 85,
};

function NewEmployeeModal({ onCreated }: { onCreated: () => void }) {
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
    if (!form.firstName || !form.lastName || !form.email || !form.employeeNumber || !form.hireDate) {
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
              {f('password',       'Mot de passe')}
              {f('employeeNumber', 'Matricule')}
              {f('jobTitle',       'Poste')}
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-bodyText">Rôle</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
                >
                  <option value="EMPLOYEE">Employé</option>
                  <option value="MANAGER">Manager chantier</option>
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

type Site = { id: string; code: string; name: string };

export default function TeamPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const { data, refresh } = useApiData<Employee[]>(() => api.employees() as Promise<Employee[]>, demoEmployees);
  const { data: sites } = useApiData<Site[]>(() => api.sites() as Promise<Site[]>, []);

  const filtered = data.filter((e) => {
    const q = search.toLowerCase();
    if (q && !`${e.user.firstName} ${e.user.lastName} ${e.user.email} ${e.employeeNumber}`.toLowerCase().includes(q)) return false;
    if (roleFilter && e.user.role !== roleFilter) return false;
    if (siteFilter && e.mainSite?.name !== siteFilter) return false;
    return true;
  });

  const columns: ColumnDef<Employee, unknown>[] = [
    { header: 'Matricule',          accessorKey: 'employeeNumber' },
    { header: 'Nom complet',        cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}` },
    { header: 'Email',              cell: ({ row }) => row.original.user.email },
    { header: 'Poste',              accessorKey: 'jobTitle' },
    { header: 'Rôle',               cell: ({ row }) => ROLE_LABELS[row.original.user.role] ?? row.original.user.role },
    { header: 'Chantier principal', cell: ({ row }) => row.original.mainSite?.name ?? '—' },
    { header: 'Statut',             cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { header: 'Solde congés',       cell: ({ row }) => `${row.original.annualLeaveBalance} j` },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <Link href={`/team/${row.original.id}`} className="text-sm font-medium text-accent hover:underline">
          Voir
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Mon équipe"
          description="Employés, rôles, affectations chantier et statut RH."
          actions={
            <div className="flex items-center gap-2">
              <CsvImportModal onImported={refresh} />
              <NewEmployeeModal onCreated={refresh} />
            </div>
          }
        />

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
            <option value="MANAGER">Manager chantier</option>
            <option value="PROJECT_MANAGER">Chef de projet</option>
            <option value="HR">RH</option>
            <option value="RESOURCE_MANAGER">Ressource Manager</option>
          </SelectField>
          <SelectField label="Chantier" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">Tous les chantiers</option>
            {sites.map((s) => (
              <option key={s.id} value={s.name}>{s.code} — {s.name}</option>
            ))}
          </SelectField>
        </div>

        <DataTable columns={columns} data={filtered} />
      </div>
    </AppShell>
  );
}
