'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AccentCard, SummaryCounters } from '@/components/ui/cards';
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { DateField, FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-items';
import { useApiData } from '@/lib/use-api-data';

type Assignment = {
  id: string;
  roleOnSite?: string;
  startDate: string;
  endDate?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    employeeProfile?: { id: string } | null;
  };
};

type Employee = {
  id: string;
  jobTitle?: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string; status?: string };
};

type SiteOptions = { siteRoleOptions: string[] };

type Project = {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
};

type AttendancePunch = {
  id: string;
  punchDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  durationMinutes?: number;
  status: string;
  user: { firstName: string; lastName: string };
};

type Site = {
  id: string;
  code: string;
  name: string;
  address?: string;
  project?: Project | null;
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  assignments: Assignment[];
  attendancePunches: AttendancePunch[];
  _count?: { assignments: number };
};

const fallbackSite: Site = {
  id: 'demo',
  code: 'MPH',
  name: 'MPH',
  assignments: [],
  attendancePunches: [],
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-mutedText">{label}</div>
      <div className="mt-1 font-semibold text-bodyText">{value ?? '—'}</div>
    </div>
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_SITE_ROLE_OPTIONS: string[] = [];

function EditSiteModal({
  site,
  employees,
  editorRole,
  onUpdated,
}: {
  site: Site;
  employees: Employee[];
  editorRole: string;
  onUpdated: () => void;
}) {
  const isHR = editorRole === 'HR';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: site.code,
    name: site.name,
    address: site.address ?? '',
    managerId: site.manager?.id ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      code: site.code,
      name: site.name,
      address: site.address ?? '',
      managerId: site.manager?.id ?? '',
    });
    setError(null);
  }, [open, site]);

  const managerOptions = employees
    .filter((employee) => employee.status === 'ACTIVE')
    .filter((employee) => employee.user.status !== 'INACTIVE')
    .sort((a, b) =>
      `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`),
    );
  async function handleSubmit() {
    if (isHR && (!form.code || !form.name || !form.managerId)) {
      setError('Le code, le nom et le chef de site sont obligatoires.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        managerId: form.managerId,
        code: form.code,
        name: form.name,
        address: form.address || undefined,
      };

      await api.updateSite(site.id, payload);
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(720px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Modifier le site</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
               <FormField disabled={!isHR} label="Code site" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
               <FormField disabled={!isHR} label="Nom du site" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
               {isHR ? (
                 <SelectField label="Chef de site" value={form.managerId} onChange={(e) => setForm((p) => ({ ...p, managerId: e.target.value }))}>
                   <option value="">Sélectionner</option>
                   {managerOptions.map((employee) => (
                     <option key={employee.user.id} value={employee.user.id}>
                       {employee.user.firstName} {employee.user.lastName}
                     </option>
                   ))}
                 </SelectField>
               ) : (
                 <FormField disabled label="Chef de site" value={site.manager ? `${site.manager.firstName} ${site.manager.lastName}` : 'Non affecté'} />
               )}
               <FormField disabled={!isHR} label="Adresse" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
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

function AssignEmployeeModal({
  siteId,
  assignments,
  employees,
  siteRoleOptions,
  onAssigned,
}: {
  siteId: string;
  assignments: Assignment[];
  employees: Employee[];
  siteRoleOptions: string[];
  onAssigned: () => void;
}) {
  const roleOptions = useMemo(() => {
    const configuredOptions = siteRoleOptions.length ? siteRoleOptions : DEFAULT_SITE_ROLE_OPTIONS;
    const seen = new Set<string>();
    const options: string[] = [];

    for (const role of configuredOptions) {
      const value = role.trim();
      if (!value) continue;

      const key = value.toLocaleLowerCase('fr-FR');
      if (seen.has(key)) continue;

      seen.add(key);
      options.push(value);
    }

    return options.length ? options : DEFAULT_SITE_ROLE_OPTIONS;
  }, [siteRoleOptions]);
  const defaultRoleOnSite = roleOptions.includes('Technicien') ? 'Technicien' : roleOptions[0] ?? '';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    startDate: todayDate(),
    endDate: '',
    roleOnSite: defaultRoleOnSite,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm((previous) =>
      previous.roleOnSite && roleOptions.includes(previous.roleOnSite)
        ? previous
        : { ...previous, roleOnSite: defaultRoleOnSite },
    );
  }, [defaultRoleOnSite, roleOptions]);

  const activeAssignedUserIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => !assignment.endDate || new Date(assignment.endDate) >= new Date())
          .map((assignment) => assignment.user.id),
      ),
    [assignments],
  );

  const availableEmployees = employees
    .filter((employee) => employee.status === 'ACTIVE')
    .filter((employee) => employee.user.status !== 'INACTIVE')
    .filter((employee) => !activeAssignedUserIds.has(employee.user.id))
    .sort((a, b) =>
      `${a.user.firstName} ${a.user.lastName}`.localeCompare(`${b.user.firstName} ${b.user.lastName}`),
    );

  function reset() {
    setForm({ userId: '', startDate: todayDate(), endDate: '', roleOnSite: defaultRoleOnSite });
    setError(null);
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!form.userId || !form.startDate) {
      setError('Employe et date de debut sont obligatoires.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        userId: form.userId,
        startDate: form.startDate,
        roleOnSite: form.roleOnSite || undefined,
      };
      if (form.endDate) {
        payload.endDate = form.endDate;
      }

      await api.assignSite(siteId, payload);
      onAssigned();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Affectation impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <PrimaryButton type="button">
          <UserPlus className="h-4 w-4" />
          Affecter un employé
        </PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">
              Affecter un employé au site
            </Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="grid gap-4 p-5">
            <SelectField
              label="Employe"
              value={form.userId}
              onChange={(event) => setForm((previous) => ({ ...previous, userId: event.target.value }))}
              disabled={availableEmployees.length === 0}
            >
              <option value="">Selectionner un employé</option>
              {availableEmployees.map((employee) => (
                <option key={employee.user.id} value={employee.user.id}>
                  {employee.user.firstName} {employee.user.lastName}
                  {employee.jobTitle ? ` - ${employee.jobTitle}` : ''}
                </option>
              ))}
            </SelectField>

            <div className="grid gap-3 md:grid-cols-2">
              <DateField
                label="Date de debut"
                value={form.startDate}
                onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))}
              />
              <DateField
                label="Date de fin optionnelle"
                value={form.endDate}
                onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))}
              />
            </div>

            <SelectField
              label="Role sur site"
              value={form.roleOnSite}
              onChange={(event) => setForm((previous) => ({ ...previous, roleOnSite: event.target.value }))}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </SelectField>

            {availableEmployees.length === 0 && (
              <p className="text-sm text-mutedText">Tous les employes actifs disponibles sont deja affectes a ce site.</p>
            )}
            {error && <p className="text-sm text-dangerText">{error}</p>}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting || availableEmployees.length === 0}>
                {submitting ? 'Affectation...' : 'Affecter'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function SiteDetailPage() {
  const params = useParams<{ id: string; siteId: string }>();
  const router = useRouter();
  const projectId = params?.id ?? '';
  const siteId = params?.siteId ?? '';
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: site, refresh } = useApiData<Site>(
    () => api.site(siteId) as Promise<Site>,
    { ...fallbackSite, id: siteId, assignments: [], attendancePunches: [] },
    { fallbackMode: 'never' },
  );
  const { data: project } = useApiData<Project>(
    () => api.project(projectId) as Promise<Project>,
    { id: projectId, code: '', name: 'Projet', clientName: null },
  );
  const myRole = tokenStore.session?.role ?? '';
  const canEditSite = myRole === 'HR';
  const canManageAssignments = myRole === 'RESOURCE_MANAGER';
  const canAssign = myRole === 'RESOURCE_MANAGER';
  const { data: employees } = useApiData<Employee[]>(
    () => (canManageAssignments || myRole === 'HR' ? (api.employees() as Promise<Employee[]>) : Promise.resolve([])),
    [],
  );
  const { data: siteOptions } = useApiData<SiteOptions>(
    () => api.settingsSiteOptions() as Promise<SiteOptions>,
    { siteRoleOptions: DEFAULT_SITE_ROLE_OPTIONS },
  );

  const assignmentColumns: ColumnDef<Assignment, unknown>[] = [
    {
      header: 'Employé',
      cell: ({ row }) => (
        <Link
          href={`/team/${row.original.user.employeeProfile!.id}`}
          className="font-semibold text-accent hover:underline"
        >
          {row.original.user.firstName} {row.original.user.lastName}
        </Link>
      ),
    },
    {
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-sm text-mutedText">{row.original.user.email}</span>
      ),
    },
    {
      header: 'Rôle',
      cell: ({ row }) => ROLE_LABELS[row.original.user.role] ?? row.original.user.role,
    },
    {
      header: 'Rôle sur site',
      cell: ({ row }) => row.original.roleOnSite ?? '—',
    },
    {
      header: 'Depuis',
      cell: ({ row }) => new Date(row.original.startDate).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Jusqu\'au',
      cell: ({ row }) =>
        row.original.endDate ? new Date(row.original.endDate).toLocaleDateString('fr-FR') : 'En cours',
    },
  ];

  const punchColumns: ColumnDef<AttendancePunch, unknown>[] = [
    {
      header: 'Employé',
      cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}`,
    },
    {
      header: 'Date',
      cell: ({ row }) => new Date(row.original.punchDate).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Entrée',
      cell: ({ row }) =>
        row.original.checkInAt
          ? new Date(row.original.checkInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '—',
    },
    {
      header: 'Sortie',
      cell: ({ row }) =>
        row.original.checkOutAt
          ? new Date(row.original.checkOutAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '—',
    },
    {
      header: 'Durée',
      cell: ({ row }) =>
        row.original.durationMinutes != null
          ? `${(row.original.durationMinutes / 60).toFixed(1)} h`
          : '—',
    },
    {
      header: 'Statut',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const activeAssignments = site.assignments.filter((a) => !a.endDate || new Date(a.endDate) >= new Date()).length;

  async function handleDeleteSite() {
    setActionError(null);
    try {
      await api.deleteSite(site.id);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-mutedText hover:text-bodyText"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au projet
          </Link>
          <PageHeader
            title={site.name}
            description={`${site.code} · Projet ${project.code}`}
            actions={
              canEditSite || canAssign ? (
                <div className="flex flex-wrap gap-2">
                  {canEditSite && (
                    <EditSiteModal
                      site={site}
                      employees={employees}
                      editorRole={myRole}
                      onUpdated={refresh}
                    />
                  )}
                  {myRole === 'HR' && (
                    <ConfirmDialog
                      title="Supprimer le site"
                      description={`Supprimer le site ${site.name} ? Il sera suspendu et masque des listes actives.`}
                      confirmLabel="Supprimer"
                      onConfirm={() => void handleDeleteSite()}
                      trigger={
                        <DangerButton type="button">
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </DangerButton>
                      }
                    />
                  )}
                  {canAssign && (
                    <AssignEmployeeModal
                      siteId={site.id}
                      assignments={site.assignments}
                      employees={employees}
                      siteRoleOptions={siteOptions.siteRoleOptions}
                      onAssigned={refresh}
                    />
                  )}
                </div>
              ) : undefined
            }
          />
        </div>

        {actionError && (
          <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
            {actionError}
          </div>
        )}

        <SummaryCounters
          items={[
            { label: 'Employés affectés', value: site.assignments.length },
            { label: 'Affectations actives', value: activeAssignments },
            { label: 'Pointages récents', value: site.attendancePunches.length },
          ]}
        />

        {/* Informations principales */}
        <AccentCard>
          <h2 className="mb-4 text-base font-bold text-bodyText">Informations du site</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow label="Nom du site" value={site.name} />
            <InfoRow label="Code" value={<span className="font-mono text-accent">{site.code}</span>} />
            <InfoRow label="Adresse" value={site.address} />
            <InfoRow
              label="Chef de site"
              value={
                site.manager ? (
                  <span>
                    {site.manager.firstName} {site.manager.lastName}
                  </span>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </AccentCard>

        {/* Employés affectés */}
        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">
            Employés affectés ({site.assignments.length})
          </h2>
          {site.assignments.length === 0 ? (
            <p className="text-sm text-mutedText">Aucune affectation enregistrée.</p>
          ) : (
            <DataTable
              columns={assignmentColumns}
              data={site.assignments}
              getRowHref={(assignment) => assignment.user.employeeProfile?.id ? `/team/${assignment.user.employeeProfile.id}` : undefined}
            />
          )}
        </section>

        {/* Derniers pointages */}
        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">
            Derniers pointages ({site.attendancePunches.length})
          </h2>
          {site.attendancePunches.length === 0 ? (
            <p className="text-sm text-mutedText">Aucun pointage récent sur ce site.</p>
          ) : (
            <DataTable columns={punchColumns} data={site.attendancePunches} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
