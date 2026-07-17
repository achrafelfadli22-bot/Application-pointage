'use client';

import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, CheckCircle2, ClipboardList, Clock4, FileClock, Users, XCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type DashboardTimesheet = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  updatedAt: string;
  totalHours: number;
  sites: string[];
  user: { firstName: string; lastName: string };
};

type DashboardData = {
  counters: {
    activeEmployees: number;
    weeklyHours: number;
    pendingTimesheets: number;
    approvedTimesheets: number;
    rejectedTimesheets: number;
    draftTimesheets: number;
    pendingLeave: number;
    activeSites: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  hoursByDay: Array<{ date: string; hours: number }>;
  latestTimesheets: DashboardTimesheet[];
};

const fallback: DashboardData = {
  counters: {
    activeEmployees: 0,
    weeklyHours: 0,
    pendingTimesheets: 0,
    approvedTimesheets: 0,
    rejectedTimesheets: 0,
    draftTimesheets: 0,
    pendingLeave: 0,
    activeSites: 0,
  },
  statusBreakdown: [],
  hoursByDay: [],
  latestTimesheets: [],
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumise',
  N1_APPROVED: 'Validée par le chef de site',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
  REOPENED: 'Rouverte',
};

const statusColors: Record<string, string> = {
  DRAFT: '#94a3b8',
  SUBMITTED: '#f59e0b',
  N1_APPROVED: '#3b82f6',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  REOPENED: '#8b5cf6',
};

function periodLabel(start: string, end: string) {
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${new Date(start).toLocaleDateString('fr-FR', options)} – ${new Date(end).toLocaleDateString('fr-FR', options)}`;
}

function Kpi({
  label,
  value,
  caption,
  href,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  caption: string;
  href: string;
  icon: React.FC<{ className?: string }>;
}) {
  return (
    <Link href={href} className="rounded-xl border border-borderSoft bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-mutedText">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-bodyText">{value}</p>
          <p className="mt-1 text-xs text-mutedText">{caption}</p>
        </div>
        <div className="rounded-lg bg-accentLight p-2 text-accent"><Icon className="h-5 w-5" /></div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { data, loading, error } = useApiData<DashboardData>(() => api.dashboard() as Promise<DashboardData>, fallback);

  const timesheetColumns: ColumnDef<DashboardTimesheet, unknown>[] = [
    {
      header: 'Collaborateur',
      cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}`,
    },
    {
      header: 'Période',
      cell: ({ row }) => periodLabel(row.original.periodStart, row.original.periodEnd),
    },
    {
      header: 'Sites',
      cell: ({ row }) => row.original.sites.join(', ') || 'Aucun site',
    },
    {
      header: 'Heures',
      cell: ({ row }) => <span className="font-semibold">{row.original.totalHours.toFixed(1)} h</span>,
    },
    {
      header: 'Statut',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          href={`/timesheets/${row.original.id}`}
          className="font-medium text-accent hover:underline"
        >
          Consulter
        </Link>
      ),
    }
  ];

  const hoursChart = data.hoursByDay.map((item) => ({
    ...item,
    day: new Date(`${item.date}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
  }));
  const statusChart = data.statusBreakdown
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, label: statusLabels[item.status] ?? item.status }));

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Tableau de bord"
          description="Synthèse des feuilles de temps, des heures déclarées et des validations."
        />

        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}

        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Heures de la semaine" value={`${data.counters.weeklyHours.toFixed(1)} h`} caption="Heures saisies dans les feuilles de temps" href="/timesheets" icon={Clock4} />
              <Kpi label="À valider" value={data.counters.pendingTimesheets} caption="Feuilles en cours de validation" href="/timesheets" icon={FileClock} />
              <Kpi label="Approuvées" value={data.counters.approvedTimesheets} caption="Feuilles validées définitivement" href="/timesheets" icon={CheckCircle2} />
              <Kpi label="Refusées" value={data.counters.rejectedTimesheets} caption="Feuilles à corriger" href="/timesheets" icon={XCircle} />
              <Kpi label="Brouillons" value={data.counters.draftTimesheets} caption="Feuilles non encore soumises" href="/timesheets" icon={ClipboardList} />
              <Kpi label="Collaborateurs actifs" value={data.counters.activeEmployees} caption="Dans votre périmètre" href="/team" icon={Users} />
              <Kpi label="Sites actifs" value={data.counters.activeSites} caption="Dans votre périmètre" href="/projects" icon={Building2} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-borderSoft bg-surface p-5 shadow-card">
                <h2 className="mb-4 font-semibold text-bodyText">Heures déclarées – 7 derniers jours</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hoursChart} barSize={28}>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)} h`, 'Heures']} />
                    <Bar dataKey="hours" fill="#3563e9" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="rounded-xl border border-borderSoft bg-surface p-5 shadow-card">
                <h2 className="mb-4 font-semibold text-bodyText">Répartition des feuilles par statut</h2>
                {statusChart.length ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={220}>
                      <PieChart>
                        <Pie data={statusChart} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={3}>
                          {statusChart.map((item) => <Cell key={item.status} fill={statusColors[item.status] ?? '#94a3b8'} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid flex-1 gap-2">
                      {statusChart.map((item) => (
                        <div key={item.status} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-mutedText"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[item.status] }} />{item.label}</span>
                          <strong>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="py-20 text-center text-sm text-mutedText">Aucune feuille de temps disponible.</p>}
              </section>
            </div>

            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-bodyText">Dernières feuilles de temps</h2>
                <Link href="/timesheets" className="text-sm font-medium text-accent hover:underline">Voir toutes les feuilles</Link>
              </div>
              <DataTable columns={timesheetColumns} data={data.latestTimesheets} pageSize={8} />
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
