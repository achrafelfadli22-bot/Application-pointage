'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Mail, Pencil, Phone, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AccentCard, SummaryCounters } from '@/components/ui/cards';
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { DateField, FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { demoEmployees } from '@/lib/demo-data';
import { ROLE_LABELS } from '@/lib/nav-items';
import { useApiData } from '@/lib/use-api-data';

type Employee = {
  id: string;
  employeeNumber: string;
  jobTitle: string;
  contractType: string;
  hireDate: string;
  annualLeaveBalance: number;
  hourlyRate?: number;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role: string;
    status: string;
  };
  mainSite?: { id: string; code: string; name: string; city?: string } | null;
};

type LeaveBalance = {
  id: string;
  year: number;
  openingBalance: number;
  accruedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  leaveType: { name: string; code: string; isPaid: boolean };
};

type AttendancePunch = {
  id: string;
  punchDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  durationMinutes?: number;
  status: string;
  site?: { code: string; name: string } | null;
};

type Site = { id: string; code: string; name: string };
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-mutedText">{label}</div>
      <div className="mt-1 font-semibold text-bodyText">{value ?? '—'}</div>
    </div>
  );
}

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function EditEmployeeModal({
  employee,
  sites,
  jobTitleOptions,
  onUpdated,
}: {
  employee: Employee;
  sites: Site[];
  jobTitleOptions: string[];
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    email: employee.user.email,
    phone: employee.user.phone ?? '',
    password: '',
    role: employee.user.role,
    employeeNumber: employee.employeeNumber,
    jobTitle: employee.jobTitle,
    contractType: employee.contractType,
    hireDate: dateInput(employee.hireDate),
    mainSiteId: employee.mainSite?.id ?? '',
    annualLeaveBalance: employee.annualLeaveBalance ?? 0,
    hourlyRate: employee.hourlyRate ?? '',
    status: employee.status,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      firstName: employee.user.firstName,
      lastName: employee.user.lastName,
      email: employee.user.email,
      phone: employee.user.phone ?? '',
      password: '',
      role: employee.user.role,
      employeeNumber: employee.employeeNumber,
      jobTitle: employee.jobTitle,
      contractType: employee.contractType,
      hireDate: dateInput(employee.hireDate),
      mainSiteId: employee.mainSite?.id ?? '',
      annualLeaveBalance: employee.annualLeaveBalance ?? 0,
      hourlyRate: employee.hourlyRate ?? '',
      status: employee.status,
    });
    setError(null);
  }, [open, employee]);

  function patch(key: keyof typeof form, value: string | number) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email || !form.employeeNumber || !form.jobTitle || !form.hireDate) {
      setError("Prenom, nom, email, matricule, poste et date d'embauche sont obligatoires.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
        employeeNumber: form.employeeNumber,
        jobTitle: form.jobTitle,
        contractType: form.contractType,
        hireDate: form.hireDate,
        mainSiteId: form.mainSiteId || null,
        annualLeaveBalance: Number(form.annualLeaveBalance),
        hourlyRate: form.hourlyRate === '' ? null : Number(form.hourlyRate),
        status: form.status,
      };
      if (form.password) payload.password = form.password;

      await api.updateEmployee(employee.id, payload);
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(760px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Modifier les donnees employe</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="grid gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Prenom" value={form.firstName} onChange={(event) => patch('firstName', event.target.value)} />
              <FormField label="Nom" value={form.lastName} onChange={(event) => patch('lastName', event.target.value)} />
              <FormField label="Email" type="email" value={form.email} onChange={(event) => patch('email', event.target.value)} />
              <FormField label="Telephone" value={form.phone} onChange={(event) => patch('phone', event.target.value)} />
              <FormField label="Nouveau mot de passe" type="password" value={form.password} onChange={(event) => patch('password', event.target.value)} />
              <SelectField label="Role" value={form.role} onChange={(event) => patch('role', event.target.value)}>
                <option value="EMPLOYEE">Employe</option>
                <option value="MANAGER">Chef de site</option>
                <option value="PROJECT_MANAGER">Chef de projet</option>
                <option value="HR">RH</option>
                <option value="RESOURCE_MANAGER">Ressource Manager</option>
              </SelectField>
              <FormField label="Matricule" value={form.employeeNumber} onChange={(event) => patch('employeeNumber', event.target.value)} />
              <SelectField label="Poste" value={form.jobTitle} onChange={(event) => patch('jobTitle', event.target.value)}>
                <option value="">Choisir un poste</option>
                {jobTitleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Type de contrat" value={form.contractType} onChange={(event) => patch('contractType', event.target.value)}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="INTERIM">Interim</option>
                <option value="FREELANCE">Freelance</option>
              </SelectField>
              <DateField label="Date d'embauche" value={form.hireDate} onChange={(event) => patch('hireDate', event.target.value)} />
              <SelectField label="Chantier principal" value={form.mainSiteId} onChange={(event) => patch('mainSiteId', event.target.value)}>
                <option value="">Aucun</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.code} - {site.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Statut employe" value={form.status} onChange={(event) => patch('status', event.target.value)}>
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
                <option value="SUSPENDED">Suspendu</option>
              </SelectField>
              <FormField
                label="Solde conges annuel (jours)"
                type="number"
                min={0}
                value={form.annualLeaveBalance}
                onChange={(event) => patch('annualLeaveBalance', Number(event.target.value))}
              />
              <FormField
                label="Taux horaire (MAD)"
                type="number"
                min={0}
                value={form.hourlyRate}
                onChange={(event) => patch('hourlyRate', event.target.value === '' ? '' : Number(event.target.value))}
              />
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

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const employeeId = params?.id ?? '';
  const fallback = (demoEmployees.find((e) => e.id === employeeId) ?? demoEmployees[0]) as Employee;
  const myRole = tokenStore.session?.role ?? '';
  const canEdit = myRole === 'RESOURCE_MANAGER';

  const { data: employee, refresh } = useApiData<Employee>(
    () => api.employee(employeeId) as Promise<Employee>,
    fallback,
  );
  const { data: sites } = useApiData<Site[]>(
    () => (canEdit ? (api.sites() as Promise<Site[]>) : Promise.resolve([])),
    [],
  );
  const { data: siteOptions } = useApiData<SiteOptions>(
    () => (canEdit ? (api.settingsSiteOptions() as Promise<SiteOptions>) : Promise.resolve({ jobTitleOptions: fallbackJobTitleOptions })),
    { jobTitleOptions: fallbackJobTitleOptions },
  );
  const jobTitleOptions = Array.from(
    new Set(
      [...(siteOptions.jobTitleOptions?.length ? siteOptions.jobTitleOptions : fallbackJobTitleOptions), employee.jobTitle]
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  );

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [punches, setPunches] = useState<AttendancePunch[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [loadingPunches, setLoadingPunches] = useState(true);

  useEffect(() => {
    setLoadingBalances(true);
    api
      .leaveBalances(employee.user.id)
      .then((data) => setBalances(data as LeaveBalance[]))
      .catch(() => {})
      .finally(() => setLoadingBalances(false));

    setLoadingPunches(true);
    api
      .attendance()
      .then((data) => {
        const all = data as AttendancePunch[];
        setPunches(all.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoadingPunches(false));
  }, [employee.user.id]);

  const punchColumns: ColumnDef<AttendancePunch, unknown>[] = [
    {
      header: 'Date',
      cell: ({ row }) => new Date(row.original.punchDate).toLocaleDateString('fr-FR'),
    },
    {
      header: 'Chantier',
      cell: ({ row }) => row.original.site?.name ?? '—',
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

  const currentYear = new Date().getFullYear();
  const currentYearBalances = balances.filter((b) => b.year === currentYear);
  const totalUsedDays = currentYearBalances.reduce((acc, b) => acc + Number(b.usedDays), 0);
  const totalRemainingDays = currentYearBalances.reduce((acc, b) => acc + Number(b.remainingDays), 0);
  const canDelete = canEdit && ['EMPLOYEE', 'MANAGER'].includes(employee.user.role);

  async function handleDelete() {
    await api.deleteEmployee(employee.id);
    router.push('/team');
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <Link
            href="/team"
            className="mb-3 inline-flex items-center gap-1 text-sm text-mutedText hover:text-bodyText"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à l'équipe
          </Link>
          <PageHeader
            title={`${employee.user.firstName} ${employee.user.lastName}`}
            description={`${employee.jobTitle} · ${employee.employeeNumber}`}
            actions={
              canEdit ? (
                <div className="flex flex-wrap items-center gap-2">
                  <EditEmployeeModal employee={employee} sites={sites} jobTitleOptions={jobTitleOptions} onUpdated={refresh} />
                  {canDelete && (
                    <ConfirmDialog
                      title="Supprimer la ressource"
                      description={`Supprimer ${employee.user.firstName} ${employee.user.lastName} ? Le compte sera desactive et retire des affectations actives.`}
                      confirmLabel="Supprimer"
                      onConfirm={handleDelete}
                      trigger={
                        <DangerButton type="button">
                          <Trash2 className="h-4 w-4" />
                          Supprimer
                        </DangerButton>
                      }
                    />
                  )}
                </div>
              ) : undefined
            }
          />
        </div>

        <SummaryCounters
          items={[
            { label: 'Statut employé', value: employee.status, active: true },
            { label: 'Rôle', value: ROLE_LABELS[employee.user.role] ?? employee.user.role },
            { label: 'Jours pris', value: `${totalUsedDays} j` },
            { label: 'Solde restant', value: `${totalRemainingDays} j` },
            { label: 'Pointages récents', value: punches.length },
          ]}
        />

        {/* Informations principales */}
        <AccentCard>
          <h2 className="mb-4 text-base font-bold text-bodyText">Informations</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow
              label="Email"
              value={
                <a href={`mailto:${employee.user.email}`} className="flex items-center gap-1 text-accent hover:underline">
                  <Mail className="h-3.5 w-3.5" />
                  {employee.user.email}
                </a>
              }
            />
            <InfoRow
              label="Téléphone"
              value={
                employee.user.phone ? (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-mutedText" />
                    {employee.user.phone}
                  </span>
                ) : (
                  '—'
                )
              }
            />
            <InfoRow label="Matricule" value={employee.employeeNumber} />
            <InfoRow label="Poste" value={employee.jobTitle} />
            <InfoRow label="Contrat" value={employee.contractType} />
            <InfoRow
              label="Date d'embauche"
              value={employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('fr-FR') : '—'}
            />
            <InfoRow
              label="Chantier principal"
              value={
                employee.mainSite ? (
                  <Link href={`/sites/${employee.mainSite.id}`} className="text-accent hover:underline">
                    {employee.mainSite.name}
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <InfoRow
              label="Taux horaire"
              value={employee.hourlyRate != null ? `${Number(employee.hourlyRate).toFixed(2)} MAD/h` : '—'}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <StatusBadge status={employee.status} />
            <StatusBadge status={employee.user.status} />
          </div>
        </AccentCard>

        {/* Soldes de congés */}
        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">
            Soldes de congés — {currentYear}
          </h2>
          {loadingBalances ? (
            <p className="text-sm text-mutedText">Chargement…</p>
          ) : currentYearBalances.length === 0 ? (
            <p className="text-sm text-mutedText">Aucun solde de congé pour cette année.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentYearBalances.map((balance) => (
                <div
                  key={balance.id}
                  className="border border-borderSoft bg-white p-4 shadow-card"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-xs font-semibold text-accent">
                        {balance.leaveType.code}
                      </div>
                      <div className="mt-0.5 font-semibold text-bodyText">
                        {balance.leaveType.name}
                      </div>
                    </div>
                    <span className="rounded bg-surfaceHover px-2 py-0.5 text-xs font-semibold text-mutedText">
                      {balance.leaveType.isPaid ? 'Payé' : 'Non payé'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-lg text-bodyText">{Number(balance.usedDays).toFixed(1)}</div>
                      <div className="text-mutedText">Pris</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg text-amber-600">{Number(balance.pendingDays).toFixed(1)}</div>
                      <div className="text-mutedText">En attente</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg text-green-600">{Number(balance.remainingDays).toFixed(1)}</div>
                      <div className="text-mutedText">Restant</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Derniers pointages */}
        <section className="grid gap-3">
          <h2 className="text-base font-bold text-bodyText">Derniers pointages</h2>
          {loadingPunches ? (
            <p className="text-sm text-mutedText">Chargement…</p>
          ) : (
            <DataTable columns={punchColumns} data={punches} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
