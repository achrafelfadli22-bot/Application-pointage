'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AccentCard, SummaryCounters } from '@/components/ui/cards';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api-client';
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-mutedText">{label}</div>
      <div className="mt-1 font-semibold text-bodyText">{value ?? '—'}</div>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const fallback = (demoEmployees.find((e) => e.id === params.id) ?? demoEmployees[0]) as Employee;

  const { data: employee } = useApiData<Employee>(
    () => api.employee(params.id) as Promise<Employee>,
    fallback,
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
