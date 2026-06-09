'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Pencil, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ProgressMeter } from '@/components/domain/progress-meter';
import { AccentCard, SummaryCounters } from '@/components/ui/cards';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DataTable } from '@/components/ui/data-table';
import { DateField, FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Employee = {
  id: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string; status?: string };
};
type SiteOptions = { siteRoleOptions: string[]; clientOptions: string[] };

type ProjectSite = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  city?: string | null;
  status: string;
  progressPercent: number;
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  _count: { assignments: number; attendancePunches: number };
};

type Project = {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
  status: string;
  startDate?: string | null;
  plannedEndDate?: string | null;
  projectManager: { id: string; firstName: string; lastName: string; email: string; role: string };
  sites: ProjectSite[];
};

const fallbackProject: Project = {
  id: 'loading',
  code: '-',
  name: 'Projet',
  clientName: null,
  status: 'ACTIVE',
  projectManager: { id: '', firstName: '-', lastName: '', email: '', role: 'PROJECT_MANAGER' },
  sites: [],
};

function dateValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function displayDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '-';
}

function EditProjectModal({
  project,
  employees,
  clientOptions,
  onUpdated,
}: {
  project: Project;
  employees: Employee[];
  clientOptions: string[];
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: project.code,
    name: project.name,
    clientName: project.clientName ?? '',
    projectManagerId: project.projectManager.id,
    startDate: dateValue(project.startDate),
    plannedEndDate: dateValue(project.plannedEndDate),
    status: project.status,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      code: project.code,
      name: project.name,
      clientName: project.clientName ?? '',
      projectManagerId: project.projectManager.id,
      startDate: dateValue(project.startDate),
      plannedEndDate: dateValue(project.plannedEndDate),
      status: project.status,
    });
    setError(null);
  }, [open, project]);

  const managerOptions = employees
    .filter((employee) => employee.status === 'ACTIVE')
    .filter((employee) => employee.user.status !== 'INACTIVE')
    .filter((employee) => employee.user.role === 'PROJECT_MANAGER');

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
      await api.updateProject(project.id, payload);
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <SecondaryButton type="button">
          <Pencil className="h-4 w-4" />
          Modifier
        </SecondaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Modifier le projet</Dialog.Title>
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
                    {employee.user.firstName} {employee.user.lastName}
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
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id ?? '';
  const myRole = tokenStore.session?.role ?? '';
  const canEdit = myRole === 'RESOURCE_MANAGER';
  const { data: project, refresh } = useApiData<Project>(() => api.project(projectId) as Promise<Project>, {
    ...fallbackProject,
    id: projectId,
  });
  const { data: employees } = useApiData<Employee[]>(
    () => (canEdit ? (api.employees() as Promise<Employee[]>) : Promise.resolve([])),
    [],
  );
  const { data: siteOptions } = useApiData<SiteOptions>(
    () => api.settingsSiteOptions() as Promise<SiteOptions>,
    { siteRoleOptions: [], clientOptions: [] },
  );
  const clientOptions = Array.from(
    new Set(
      [project.clientName, ...(siteOptions.clientOptions ?? []), ...project.sites.map((site) => site.clientName)]
        .map((client) => client?.trim())
        .filter(Boolean) as string[],
    ),
  ).sort();

  async function handleDelete() {
    await api.deleteProject(project.id);
    router.push('/projects');
  }

  const columns: ColumnDef<ProjectSite, unknown>[] = [
    { header: 'Code', accessorKey: 'code' },
    {
      header: 'Chantier',
      cell: ({ row }) => (
        <Link href={`/sites/${row.original.id}`} className="font-semibold text-accent hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { header: 'Client', accessorKey: 'clientName' },
    { header: 'Ville', cell: ({ row }) => row.original.city ?? '-' },
    { header: 'Chef de site', cell: ({ row }) => row.original.manager ? `${row.original.manager.firstName} ${row.original.manager.lastName}` : '-' },
    { header: 'Equipe', cell: ({ row }) => row.original._count.assignments },
    { header: 'Avancement', cell: ({ row }) => <ProgressMeter value={row.original.progressPercent} size="sm" /> },
    { header: 'Statut', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-mutedText hover:text-bodyText">
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux projets
          </Link>
          <PageHeader
            title={project.name}
            description={`${project.code} - ${project.clientName ?? 'Client non renseigne'}`}
            actions={
              canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <EditProjectModal project={project} employees={employees} clientOptions={clientOptions} onUpdated={refresh} />
                  <ConfirmDialog
                    title="Supprimer le projet"
                    description={`Supprimer le projet ${project.name} ? Il sera suspendu et masque de la liste active.`}
                    confirmLabel="Supprimer"
                    onConfirm={() => void handleDelete()}
                    trigger={
                      <DangerButton type="button">
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </DangerButton>
                    }
                  />
                </div>
              ) : undefined
            }
          />
        </div>

        <SummaryCounters
          items={[
            { label: 'Statut', value: project.status, active: true },
            { label: 'Chantiers', value: project.sites.length },
            { label: 'Debut', value: displayDate(project.startDate) },
            { label: 'Fin prevue', value: displayDate(project.plannedEndDate) },
          ]}
        />

        <AccentCard>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase text-mutedText">Code</div>
              <div className="mt-1 font-mono font-semibold text-accent">{project.code}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-mutedText">Client</div>
              <div className="mt-1 font-semibold text-bodyText">{project.clientName ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-mutedText">Chef de projet</div>
              <div className="mt-1 font-semibold text-bodyText">
                {project.projectManager.firstName} {project.projectManager.lastName}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-mutedText">Email chef projet</div>
              <div className="mt-1 font-semibold text-bodyText">{project.projectManager.email || '-'}</div>
            </div>
          </div>
        </AccentCard>

        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">Chantiers du projet ({project.sites.length})</h2>
          {project.sites.length === 0 ? (
            <p className="text-sm text-mutedText">Aucun chantier rattache a ce projet.</p>
          ) : (
            <DataTable columns={columns} data={project.sites} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
