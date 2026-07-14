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
import { DateField, FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Project = {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
  status: string;
  startDate?: string | null;
  plannedEndDate?: string | null;
  projectManager: { id: string; firstName: string; lastName: string; email: string; role: string };
  _count: { sites: number };
};

type Employee = {
  id: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
};
type SiteOptions = { siteRoleOptions: string[]; clientOptions: string[] };

const emptyForm = {
  code: '',
  name: '',
  clientName: '',
  projectManagerId: '',
  startDate: '',
  plannedEndDate: '',
  status: 'ACTIVE',
};

function NewProjectModal({ onCreated, clientOptions }: { onCreated: () => void; clientOptions: string[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: employees } = useApiData<Employee[]>(() => api.employees() as Promise<Employee[]>, []);
  const managerOptions = employees.filter((employee) => employee.user.role === 'PROJECT_MANAGER');

  function reset() {
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit() {
    if (!form.code || !form.name || !form.projectManagerId) {
      setError('Code, nom et chef de projet sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.clientName) delete payload.clientName;
      if (!form.startDate) delete payload.startDate;
      if (!form.plannedEndDate) delete payload.plannedEndDate;
      await api.createProject(payload);
      setOpen(false);
      reset();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
      <Dialog.Trigger asChild>
        <PrimaryButton type="button"><Plus className="h-4 w-4" /> Nouveau projet</PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Nouveau projet</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Code projet" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              <FormField label="Nom du projet" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <SelectField label="Client / Maitre d'ouvrage" value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}>
                <option value="">Non renseigne</option>
                {clientOptions.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Chef de projet" value={form.projectManagerId} onChange={(e) => setForm((p) => ({ ...p, projectManagerId: e.target.value }))}>
                <option value="">Selectionner</option>
                {managerOptions.map((employee) => (
                  <option key={employee.user.id} value={employee.user.id}>
                    {employee.user.firstName} {employee.user.lastName} - Chef de projet
                  </option>
                ))}
              </SelectField>
              <SelectField label="Etat du projet" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="ACTIVE">Actif</option>
                <option value="SUSPENDED">Suspendu</option>
                <option value="COMPLETED">Termine</option>
              </SelectField>
              <DateField label="Date de debut" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              <DateField label="Fin prevue" value={form.plannedEndDate} onChange={(e) => setForm((p) => ({ ...p, plannedEndDate: e.target.value }))} />
            </div>
            {error && <p className="text-sm text-dangerText">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creation...' : 'Creer le projet'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const { data, refresh } = useApiData<Project[]>(() => api.projects() as Promise<Project[]>, []);
  const { data: siteOptions } = useApiData<SiteOptions>(
    () => api.settingsSiteOptions() as Promise<SiteOptions>,
    { siteRoleOptions: [], clientOptions: [] },
  );
  const myRole = tokenStore.session?.role ?? '';
  const canCreate = myRole === 'RESOURCE_MANAGER';
  const clientOptions = Array.from(
    new Set(
      [...(siteOptions.clientOptions ?? []), ...data.map((project) => project.clientName)]
        .map((client) => client?.trim())
        .filter(Boolean) as string[],
    ),
  ).sort();

  const filtered = data.filter((project) => {
    const q = search.toLowerCase();
    return !q || `${project.code} ${project.name} ${project.clientName ?? ''}`.toLowerCase().includes(q);
  });

  const columns: ColumnDef<Project, unknown>[] = [
    { header: 'Code', accessorKey: 'code' },
    { header: 'Projet', accessorKey: 'name' },
    { header: 'Client', cell: ({ row }) => row.original.clientName ?? '-' },
    { header: 'Chef de projet', cell: ({ row }) => `${row.original.projectManager.firstName} ${row.original.projectManager.lastName}` },
    { header: 'Sites', cell: ({ row }) => row.original._count.sites },
    { header: 'Statut', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <Link href={`/projects/${row.original.id}`} className="text-sm font-medium text-accent hover:underline">
          Voir
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Projets"
          description="Designation du chef de projet et rattachement des sites."
          actions={canCreate ? <NewProjectModal onCreated={refresh} clientOptions={clientOptions} /> : undefined}
        />

        <div className="rounded-xl border border-borderSoft bg-surface p-4 shadow-card">
          <FormField
            label="Recherche"
            placeholder="Code, nom, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <DataTable columns={columns} data={filtered} />
      </div>
    </AppShell>
  );
}
