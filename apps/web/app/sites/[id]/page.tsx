'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, MapPin, UserPlus, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { ProgressMeter } from '@/components/domain/progress-meter';
import { SiteMap } from '@/components/domain/site-map';
import { AccentCard, SummaryCounters } from '@/components/ui/cards';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DataTable } from '@/components/ui/data-table';
import { DateField, FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-items';
import { demoSites } from '@/lib/demo-data';
import { useApiData } from '@/lib/use-api-data';

type Assignment = {
  id: string;
  roleOnSite?: string;
  startDate: string;
  endDate?: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
};

type Employee = {
  id: string;
  jobTitle?: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string; status?: string };
};

type AttendancePunch = {
  id: string;
  punchDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  durationMinutes?: number;
  isGpsAnomaly: boolean;
  status: string;
  user: { firstName: string; lastName: string };
};

type Site = {
  id: string;
  code: string;
  name: string;
  clientName: string;
  address?: string;
  city?: string;
  country?: string;
  status: string;
  progressPercent: number;
  latitude?: number;
  longitude?: number;
  gpsRadiusMeters: number;
  startDate?: string;
  plannedEndDate?: string;
  manager?: { id: string; firstName: string; lastName: string; email: string } | null;
  assignments: Assignment[];
  attendancePunches: AttendancePunch[];
  _count?: { assignments: number };
};

const fallbackSite: Site = {
  id: 'demo',
  code: 'CH-001',
  name: 'Résidence Palmier',
  clientName: 'Palmier Invest',
  city: 'Casablanca',
  country: 'MA',
  status: 'ACTIVE',
  progressPercent: 42,
  gpsRadiusMeters: 250,
  latitude: 33.5731,
  longitude: -7.5898,
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

function AssignEmployeeModal({
  siteId,
  assignments,
  employees,
  onAssigned,
}: {
  siteId: string;
  assignments: Assignment[];
  employees: Employee[];
  onAssigned: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    startDate: todayDate(),
    endDate: '',
    roleOnSite: 'Technicien',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setForm({ userId: '', startDate: todayDate(), endDate: '', roleOnSite: 'Technicien' });
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
          Affecter un employe
        </PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">
              Affecter un employe au chantier
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
              <option value="">Selectionner un employe</option>
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

            <FormField
              label="Role sur chantier"
              value={form.roleOnSite}
              placeholder="Technicien, chef d'equipe..."
              onChange={(event) => setForm((previous) => ({ ...previous, roleOnSite: event.target.value }))}
            />

            {availableEmployees.length === 0 && (
              <p className="text-sm text-mutedText">Tous les employes actifs disponibles sont deja affectes a ce chantier.</p>
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
  const params = useParams<{ id: string }>();
  const fallback = (demoSites.find((s) => s.id === params.id) as Site | undefined) ?? fallbackSite;

  const { data: site, refresh } = useApiData<Site>(
    () => api.site(params.id) as Promise<Site>,
    { ...fallback, assignments: [], attendancePunches: [] },
  );
  const myRole = tokenStore.session?.role ?? '';
  const currentUserId = tokenStore.session?.user.id;
  const canManageAssignments = ['RESOURCE_MANAGER', 'HR', 'MANAGER'].includes(myRole);
  const canAssign =
    ['RESOURCE_MANAGER', 'HR'].includes(myRole) || (myRole === 'MANAGER' && site.manager?.id === currentUserId);
  const { data: employees } = useApiData<Employee[]>(
    () => (canManageAssignments ? (api.employees() as Promise<Employee[]>) : Promise.resolve([])),
    [],
  );

  const assignmentColumns: ColumnDef<Assignment, unknown>[] = [
    {
      header: 'Employé',
      cell: ({ row }) => (
        <Link href={`/team/${row.original.user.id}`} className="font-semibold text-accent hover:underline">
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
      header: 'Rôle sur chantier',
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
      header: 'GPS',
      cell: ({ row }) => (
        <span className={row.original.isGpsAnomaly ? 'font-semibold text-dangerText' : 'text-green-600'}>
          {row.original.isGpsAnomaly ? 'Anomalie' : 'OK'}
        </span>
      ),
    },
    {
      header: 'Statut',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const gpsAnomalies = site.attendancePunches.filter((p) => p.isGpsAnomaly).length;
  const activeAssignments = site.assignments.filter((a) => !a.endDate || new Date(a.endDate) >= new Date()).length;

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <Link
            href="/sites"
            className="mb-3 inline-flex items-center gap-1 text-sm text-mutedText hover:text-bodyText"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux chantiers
          </Link>
          <PageHeader
            title={site.name}
            description={`${site.code} · ${site.clientName}`}
            actions={
              canAssign ? (
                <AssignEmployeeModal
                  siteId={site.id}
                  assignments={site.assignments}
                  employees={employees}
                  onAssigned={refresh}
                />
              ) : undefined
            }
          />
        </div>

        <SummaryCounters
          items={[
            { label: 'Statut', value: site.status, active: true },
            { label: 'Avancement', value: `${site.progressPercent ?? 0}%` },
            { label: 'Employés affectés', value: site.assignments.length },
            { label: 'Affectations actives', value: activeAssignments },
            { label: 'Anomalies GPS', value: gpsAnomalies },
            { label: 'Pointages récents', value: site.attendancePunches.length },
          ]}
        />

        {/* Informations principales */}
        <AccentCard>
          <h2 className="mb-4 text-base font-bold text-bodyText">Informations du chantier</h2>
          <div className="mb-5 max-w-xl">
            <div className="mb-2 text-xs font-semibold uppercase text-mutedText">Avancement du projet</div>
            <ProgressMeter value={site.progressPercent} className="max-w-md" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow label="Code" value={<span className="font-mono text-accent">{site.code}</span>} />
            <InfoRow label="Client" value={site.clientName} />
            <InfoRow label="Ville" value={site.city} />
            <InfoRow label="Pays" value={site.country} />
            <InfoRow label="Adresse" value={site.address} />
            <InfoRow
              label="Manager"
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
            <InfoRow
              label="Date début"
              value={site.startDate ? new Date(site.startDate).toLocaleDateString('fr-FR') : '—'}
            />
            <InfoRow
              label="Fin prévue"
              value={site.plannedEndDate ? new Date(site.plannedEndDate).toLocaleDateString('fr-FR') : '—'}
            />
          </div>
          <div className="mt-4">
            <StatusBadge status={site.status} />
          </div>
        </AccentCard>

        {/* Géolocalisation GPS */}
        <AccentCard>
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-bodyText">
            <MapPin className="h-4 w-4 text-accent" />
            Géolocalisation GPS
          </h2>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <InfoRow
              label="Latitude"
              value={site.latitude != null ? Number(site.latitude).toFixed(6) : '—'}
            />
            <InfoRow
              label="Longitude"
              value={site.longitude != null ? Number(site.longitude).toFixed(6) : '—'}
            />
            <InfoRow label="Rayon de tolérance" value={`${site.gpsRadiusMeters} m`} />
          </div>

          {/* Légende */}
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-mutedText">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
              Pointage dans le périmètre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
              Anomalie GPS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-blue-500 bg-blue-100" />
              Zone autorisée ({site.gpsRadiusMeters} m)
            </span>
          </div>

          {site.latitude != null && site.longitude != null ? (
            <SiteMap
              latitude={Number(site.latitude)}
              longitude={Number(site.longitude)}
              gpsRadiusMeters={site.gpsRadiusMeters}
              siteName={site.name}
              punches={site.attendancePunches as Parameters<typeof SiteMap>[0]['punches']}
            />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-borderSoft text-sm text-mutedText">
              Coordonnées GPS non renseignées pour ce chantier.
            </div>
          )}
        </AccentCard>

        {/* Employés affectés */}
        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">
            Employés affectés ({site.assignments.length})
          </h2>
          {site.assignments.length === 0 ? (
            <p className="text-sm text-mutedText">Aucune affectation enregistrée.</p>
          ) : (
            <DataTable columns={assignmentColumns} data={site.assignments} />
          )}
        </section>

        {/* Derniers pointages */}
        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">
            Derniers pointages ({site.attendancePunches.length})
          </h2>
          {site.attendancePunches.length === 0 ? (
            <p className="text-sm text-mutedText">Aucun pointage récent sur ce chantier.</p>
          ) : (
            <DataTable columns={punchColumns} data={site.attendancePunches} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
