'use client';

import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Clock4, UserX, CalendarClock, Timer,
  ClipboardList, Building2, CheckCircle2, AlertCircle,
  Hourglass, AlertTriangle, MapPin,
  ArrowRight, XCircle, Info,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import { demoCounters, demoLeaveRequests, demoTimesheets } from '@/lib/demo-data';
import { useApiData } from '@/lib/use-api-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = {
  counters: typeof demoCounters;
  latestPunches: Array<Record<string, unknown>>;
  pendingLeaveRequests: typeof demoLeaveRequests;
  timesheetsToApprove: typeof demoTimesheets;
};

type Punch = {
  id: string;
  punchDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number | null;
  status: string;
  site: { name: string } | null;
};

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  updatedAt: string;
  leaveType: { name: string };
  user: { firstName: string; lastName: string };
};

type Balance = {
  year: number;
  leaveType: { name: string };
  remainingDays: number | string;
  usedDays: number | string;
  pendingDays: number | string;
};

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const fallbackAdmin: DashboardData = {
  counters: demoCounters,
  latestPunches: [
    {
      id: 'p1', punchDate: '2026-05-23T00:00:00.000Z',
      checkInAt: '2026-05-23T08:00:00.000Z', status: 'SUBMITTED',
      user: { firstName: 'Omar', lastName: 'Mansouri' },
      site: { name: 'MPH' },
    },
  ],
  pendingLeaveRequests: demoLeaveRequests,
  timesheetsToApprove: demoTimesheets,
};

const fallbackPunches: Punch[] = [
  {
    id: 'p1', punchDate: '2026-05-23T00:00:00.000Z',
    checkInAt: '2026-05-23T08:00:00.000Z', checkOutAt: '2026-05-23T17:00:00.000Z',
    durationMinutes: 540, status: 'APPROVED',
    site: { name: 'MPH' },
  },
  {
    id: 'p2', punchDate: '2026-05-22T00:00:00.000Z',
    checkInAt: '2026-05-22T08:05:00.000Z', checkOutAt: '2026-05-22T17:10:00.000Z',
    durationMinutes: 545, status: 'APPROVED',
    site: { name: 'SAFI' },
  },
  {
    id: 'p3', punchDate: '2026-05-21T00:00:00.000Z',
    checkInAt: '2026-05-21T07:55:00.000Z', checkOutAt: null,
    durationMinutes: null, status: 'SUBMITTED',
    site: { name: 'MPH' },
  },
];

const fallbackLeave: LeaveRequest[] = [
  {
    id: 'l1', startDate: '2026-06-03T00:00:00.000Z', endDate: '2026-06-05T00:00:00.000Z',
    durationDays: 3, status: 'SUBMITTED', updatedAt: '2026-05-22T10:30:00.000Z',
    leaveType: { name: 'Congé annuel' },
    user: { firstName: 'Omar', lastName: 'Mansouri' },
  },
];

const fallbackBalances: Balance[] = [
  { year: 2026, leaveType: { name: 'Congé annuel' }, remainingDays: 15, usedDays: 3, pendingDays: 1 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('fr-FR', opts);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function isSameDay(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

type AlertKind = 'warning' | 'danger' | 'info' | 'success';

function AlertBanner({ kind, icon: Icon, children }: {
  kind: AlertKind;
  icon: React.FC<{ className?: string }>;
  children: React.ReactNode;
}) {
  const styles: Record<AlertKind, string> = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger:  'bg-red-50   border-red-200   text-red-800',
    info:    'bg-blue-50  border-blue-200  text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };
  const iconStyles: Record<AlertKind, string> = {
    warning: 'text-amber-500',
    danger:  'text-red-500',
    info:    'text-blue-500',
    success: 'text-green-500',
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconStyles[kind]}`} />
      <span>{children}</span>
    </div>
  );
}

// ─── Colored Stat Card ────────────────────────────────────────────────────────

type CardAccent = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'neutral';

function KpiCard({
  label, value, caption, icon: Icon, accent = 'neutral', href,
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon?: React.FC<{ className?: string }>;
  accent?: CardAccent;
  href?: string;
}) {
  const bg: Record<CardAccent, string> = {
    blue:    'bg-blue-50   border-blue-100',
    green:   'bg-green-50  border-green-100',
    amber:   'bg-amber-50  border-amber-100',
    red:     'bg-red-50    border-red-100',
    violet:  'bg-violet-50 border-violet-100',
    neutral: 'bg-surface   border-borderSoft',
  };
  const iconBg: Record<CardAccent, string> = {
    blue:    'bg-blue-100   text-blue-600',
    green:   'bg-green-100  text-green-600',
    amber:   'bg-amber-100  text-amber-600',
    red:     'bg-red-100    text-red-600',
    violet:  'bg-violet-100 text-violet-600',
    neutral: 'bg-accentLight text-accent',
  };
  const valColor: Record<CardAccent, string> = {
    blue:    'text-blue-700',
    green:   'text-green-700',
    amber:   'text-amber-700',
    red:     'text-red-700',
    violet:  'text-violet-700',
    neutral: 'text-bodyText',
  };

  const inner = (
    <div className={`rounded-xl border p-5 shadow-card transition-all ${bg[accent]} ${href ? 'hover:shadow-md cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-mutedText">{label}</p>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg[accent]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className={`mt-3 text-3xl font-semibold ${valColor[accent]}`}>{value}</p>
      {caption && <p className="mt-1 text-xs text-mutedText">{caption}</p>}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-bodyText">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accentLight px-1.5 text-xs font-semibold text-accentText">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

// ─── Punch Timeline Row ───────────────────────────────────────────────────────

function PunchRow({ punch }: { punch: Punch }) {
  const statusColor: Record<string, string> = {
    APPROVED:  'bg-green-500',
    REJECTED:  'bg-red-500',
    SUBMITTED: 'bg-amber-400',
    DRAFT:     'bg-gray-300',
  };
  const dot = statusColor[punch.status] ?? 'bg-gray-300';

  return (
    <div className="flex items-center gap-4 py-3">
      {/* Dot timeline */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      </div>
      {/* Date */}
      <div className="w-28 shrink-0">
        <p className="text-sm font-medium text-bodyText capitalize">
          {fmt(punch.punchDate, { weekday: 'short', day: '2-digit', month: 'short' })}
        </p>
      </div>
      {/* Site */}
      {punch.site && (
        <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-mutedText">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{punch.site.name}</span>
        </div>
      )}
      {/* Horaires */}
      <div className="flex items-center gap-1.5 text-xs text-mutedText shrink-0">
        <span>{punch.checkInAt ? fmtTime(punch.checkInAt) : '—'}</span>
        <span>→</span>
        <span>{punch.checkOutAt ? fmtTime(punch.checkOutAt) : '—'}</span>
      </div>
      {/* Durée */}
      <div className="w-14 shrink-0 text-right text-xs font-semibold text-bodyText">
        {punch.durationMinutes ? `${(punch.durationMinutes / 60).toFixed(1)} h` : '—'}
      </div>
      {/* Badge */}
      <div className="shrink-0">
        <StatusBadge status={punch.status} />
      </div>
    </div>
  );
}

// ─── Leave Request Row ────────────────────────────────────────────────────────

function LeaveRow({ leave }: { leave: LeaveRequest }) {
  const isRejected  = leave.status === 'REJECTED';
  const isApproved  = leave.status === 'APPROVED';
  const isPending   = leave.status === 'SUBMITTED';

  return (
    <div className={`flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors ${
      isRejected ? 'bg-red-50' : isPending ? 'bg-amber-50' : 'hover:bg-surfaceHover'
    }`}>
      {/* Type */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-bodyText truncate">{leave.leaveType.name}</p>
        <p className="text-xs text-mutedText">
          {fmt(leave.startDate)} – {fmt(leave.endDate)}
          <span className="ml-1 font-medium">· {leave.durationDays} j</span>
        </p>
      </div>
      {/* Icons for rejected/pending */}
      {isRejected && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
      {isPending  && <Hourglass className="h-4 w-4 shrink-0 text-amber-500" />}
      {isApproved && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />}
      <StatusBadge status={leave.status} />
    </div>
  );
}

// ─── Vue Employé ──────────────────────────────────────────────────────────────

function EmployeeDashboard() {
  const { data: punches }  = useApiData<Punch[]>(() => api.attendance() as Promise<Punch[]>, fallbackPunches);
  const { data: leaves }   = useApiData<LeaveRequest[]>(() => api.leaveRequests() as Promise<LeaveRequest[]>, fallbackLeave);
  const { data: balances } = useApiData<Balance[]>(() => api.leaveBalances() as Promise<Balance[]>, fallbackBalances);

  const firstName = tokenStore.session?.user?.firstName ?? '';

  // ── Stats ──────────────────────────────────────────────────────────────────
  const today = new Date();
  const currentYear = today.getFullYear();

  // Heures cette semaine
  const startOfWeek = new Date(today);
  startOfWeek.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const weekMinutes = punches
    .filter((p) => new Date(p.punchDate) >= startOfWeek && p.durationMinutes)
    .reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0);
  const weekHours = weekMinutes / 60;

  // Solde restant total
  const totalRemaining = balances
    .filter((b) => b.year === currentYear)
    .reduce((sum, b) => sum + Number(b.remainingDays), 0);

  // Demandes en attente / refusées
  const pendingLeaves  = leaves.filter((l) => l.status === 'SUBMITTED');
  const rejectedLeaves = leaves.filter((l) => l.status === 'REJECTED');

  // Pointage aujourd'hui
  const todayPunch = punches.find((p) => isSameDay(new Date(p.punchDate), today));
  const isWeekend  = today.getDay() === 0 || today.getDay() === 6;

  // Récents (5 derniers)
  const recentPunches = [...punches]
    .sort((a, b) => new Date(b.punchDate).getTime() - new Date(a.punchDate).getTime())
    .slice(0, 5);

  // Alerte solde bas
  const lowBalance = totalRemaining > 0 && totalRemaining <= 3;

  // ── Greeting ───────────────────────────────────────────────────────────────
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <AppShell>
      <div className="grid gap-5">

        {/* Header */}
        <PageHeader
          title={`${greeting}${firstName ? `, ${firstName}` : ''} 👋`}
          description={today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        />

        {/* ── Alertes contextuelles ─────────────────────────────────────────── */}
        <div className="grid gap-2">
          {/* Non pointé aujourd'hui (jour ouvré) */}
          {!isWeekend && !todayPunch && (
            <AlertBanner kind="warning" icon={AlertTriangle}>
              Vous n'avez pas encore pointé aujourd'hui.{' '}
              <Link href="/attendance" className="font-semibold underline underline-offset-2">
                Aller au pointage →
              </Link>
            </AlertBanner>
          )}

          {/* Congé(s) refusé(s) */}
          {rejectedLeaves.length > 0 && (
            <AlertBanner kind="danger" icon={XCircle}>
              {rejectedLeaves.length === 1
                ? 'Votre demande de congé a été refusée.'
                : `${rejectedLeaves.length} demandes de congé ont été refusées.`}{' '}
              <Link href="/time-off" className="font-semibold underline underline-offset-2">
                Voir mes congés →
              </Link>
            </AlertBanner>
          )}

          {/* Solde bas */}
          {lowBalance && (
            <AlertBanner kind="warning" icon={Info}>
              Votre solde de congés est faible : <strong>{totalRemaining} jour{totalRemaining > 1 ? 's' : ''}</strong> restant{totalRemaining > 1 ? 's' : ''}.
            </AlertBanner>
          )}

          {/* Pointage en cours (check-in sans check-out) */}
          {todayPunch && todayPunch.checkInAt && !todayPunch.checkOutAt && (
            <AlertBanner kind="info" icon={Clock4}>
              Vous êtes pointé depuis <strong>{fmtTime(todayPunch.checkInAt)}</strong> — n'oubliez pas de pointer votre départ.
            </AlertBanner>
          )}
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Heures cette semaine"
            value={`${weekHours.toFixed(1)} h`}
            caption={weekHours >= 40 ? 'Semaine complète ✓' : `${(40 - weekHours).toFixed(1)} h restantes`}
            icon={Timer}
            accent={weekHours >= 40 ? 'green' : 'blue'}
            href="/attendance"
          />
          <KpiCard
            label="Solde congés restant"
            value={`${totalRemaining} j`}
            caption={lowBalance ? 'Solde faible' : 'Disponible'}
            icon={CalendarClock}
            accent={totalRemaining === 0 ? 'red' : lowBalance ? 'amber' : 'green'}
            href="/time-off"
          />
          <KpiCard
            label="Demandes en attente"
            value={pendingLeaves.length}
            caption={pendingLeaves.length > 0 ? 'En cours de traitement' : 'Aucune en attente'}
            icon={Hourglass}
            accent={pendingLeaves.length > 0 ? 'amber' : 'neutral'}
            href="/time-off"
          />
          <KpiCard
            label="Pointages cette semaine"
            value={punches.filter((p) => new Date(p.punchDate) >= startOfWeek).length}
            caption="Jours ouvrés pointés"
            icon={Clock4}
            accent="neutral"
            href="/attendance"
          />
        </div>

        {/* ── Statut aujourd'hui ────────────────────────────────────────────── */}
        {!isWeekend && (
          <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 shadow-card ${
            !todayPunch
              ? 'border-amber-200 bg-amber-50'
              : todayPunch.checkOutAt
              ? 'border-green-200 bg-green-50'
              : 'border-blue-200 bg-blue-50'
          }`}>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              !todayPunch ? 'bg-amber-100' : todayPunch.checkOutAt ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {!todayPunch
                ? <AlertTriangle className="h-5 w-5 text-amber-600" />
                : todayPunch.checkOutAt
                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                : <Clock4 className="h-5 w-5 text-blue-600" />
              }
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                !todayPunch ? 'text-amber-800' : todayPunch.checkOutAt ? 'text-green-800' : 'text-blue-800'
              }`}>
                {!todayPunch
                  ? 'Pas encore pointé aujourd\'hui'
                  : todayPunch.checkOutAt
                  ? `Journée terminée — ${((todayPunch.durationMinutes ?? 0) / 60).toFixed(1)} h travaillées`
                  : `En service depuis ${todayPunch.checkInAt ? fmtTime(todayPunch.checkInAt) : '—'}`
                }
              </p>
              {todayPunch?.site && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-mutedText">
                  <MapPin className="h-3 w-3" /> {todayPunch.site.name}
                </p>
              )}
            </div>
            <Link href="/attendance" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline shrink-0">
              {!todayPunch ? 'Pointer' : 'Voir'} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* ── Derniers pointages ────────────────────────────────────────────── */}
        <section className="grid gap-3">
          <SectionHeader title="Mes derniers pointages" href="/attendance" />
          <div className="rounded-xl border border-borderSoft bg-surface px-4 shadow-card divide-y divide-borderSoft">
            {recentPunches.length === 0 ? (
              <p className="py-8 text-center text-sm text-mutedText">Aucun pointage enregistré.</p>
            ) : (
              recentPunches.map((p) => <PunchRow key={p.id} punch={p} />)
            )}
          </div>
        </section>

        {/* ── Demandes de congé ─────────────────────────────────────────────── */}
        <section className="grid gap-3">
          <SectionHeader
            title="Mes demandes de congé"
            href="/time-off"
            count={pendingLeaves.length + rejectedLeaves.length}
          />
          {leaves.length === 0 ? (
            <div className="rounded-xl border border-borderSoft bg-surface px-5 py-8 text-center text-sm text-mutedText shadow-card">
              Aucune demande de congé enregistrée.
            </div>
          ) : (
            <div className="rounded-xl border border-borderSoft bg-surface p-2 shadow-card grid gap-1">
              {[...leaves]
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .slice(0, 6)
                .map((l) => <LeaveRow key={l.id} leave={l} />)
              }
            </div>
          )}
        </section>

      </div>
    </AppShell>
  );
}

// ─── Vue Manager / HR / Admin ─────────────────────────────────────────────────

function AdminDashboard() {
  const { data } = useApiData<DashboardData>(
    () => api.dashboard() as Promise<DashboardData>,
    fallbackAdmin,
  );

  const firstName = tokenStore.session?.user?.firstName ?? '';

  // Alertes admin
  const lateCount      = Number(data.counters.lateToday ?? 0);
  const pendingTS      = Number(data.counters.pendingTimesheets ?? 0);
  const pendingLeave   = Number(data.counters.pendingLeave ?? 0);
  const absentCount    = Number(data.counters.absentToday ?? 0);

  type AdminPunch = (typeof fallbackAdmin.latestPunches)[number];

  const punchColumns: ColumnDef<AdminPunch, unknown>[] = [
    { header: 'Employé',  cell: ({ row }) => { const u = row.original.user as { firstName: string; lastName: string }; return `${u.firstName} ${u.lastName}`; } },
    { header: 'Chantier', cell: ({ row }) => { const s = row.original.site as { name: string } | null; return s?.name ?? '—'; } },
    { header: 'Date',     cell: ({ row }) => new Date(row.original.punchDate as string).toLocaleDateString('fr-FR') },
    { header: 'Entrée',   cell: ({ row }) => row.original.checkInAt ? new Date(row.original.checkInAt as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—' },
    { header: 'Statut',   cell: ({ row }) => <StatusBadge status={row.original.status as string} /> },
  ];

  const leaveColumns: ColumnDef<(typeof demoLeaveRequests)[number], unknown>[] = [
    { header: 'Employé', cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}` },
    { header: 'Type',    cell: ({ row }) => row.original.leaveType.name },
    { header: 'Début',   cell: ({ row }) => new Date(row.original.startDate).toLocaleDateString('fr-FR') },
    { header: 'Durée',   cell: ({ row }) => `${row.original.durationDays} j` },
    { header: 'Statut',  cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Action',
      cell: () => (
        <Link href="/time-off/requests" className="text-xs font-medium text-accent hover:underline">
          Traiter →
        </Link>
      ),
    },
  ];

  const tsColumns: ColumnDef<(typeof demoTimesheets)[number], unknown>[] = [
    { header: 'Employé', cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}` },
    { header: 'Période', cell: ({ row }) => `${new Date(row.original.periodStart).toLocaleDateString('fr-FR')} – ${new Date(row.original.periodEnd).toLocaleDateString('fr-FR')}` },
    { header: 'Statut',  cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Action',
      cell: () => (
        <Link href="/timesheets" className="text-xs font-medium text-accent hover:underline">
          Approuver →
        </Link>
      ),
    },
  ];

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <AppShell>
      <div className="grid gap-5">

        <PageHeader
          title={`${greeting}${firstName ? `, ${firstName}` : ''} 👋`}
          description={today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        />

        {/* ── Alertes urgentes ──────────────────────────────────────────────── */}
        <div className="grid gap-2">
          {lateCount > 0 && (
            <AlertBanner kind="warning" icon={AlertTriangle}>
              <strong>{lateCount} employé{lateCount > 1 ? 's' : ''}</strong> en retard aujourd'hui.{' '}
              <Link href="/attendance" className="font-semibold underline underline-offset-2">
                Voir les pointages →
              </Link>
            </AlertBanner>
          )}
          {pendingTS > 0 && (
            <AlertBanner kind="warning" icon={ClipboardList}>
              <strong>{pendingTS} timesheet{pendingTS > 1 ? 's' : ''}</strong> en attente de validation.{' '}
              <Link href="/timesheets" className="font-semibold underline underline-offset-2">
                Approuver →
              </Link>
            </AlertBanner>
          )}
          {absentCount > 0 && (
            <AlertBanner kind="info" icon={UserX}>
              <strong>{absentCount} absence{absentCount > 1 ? 's' : ''}</strong> non justifiée{absentCount > 1 ? 's' : ''} aujourd'hui.
            </AlertBanner>
          )}
        </div>

        {/* ── KPIs présence ─────────────────────────────────────────────────── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-mutedText">Présence du jour</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Employés actifs"
              value={data.counters.activeEmployees}
              icon={Users}
              accent="neutral"
              href="/team"
            />
            <KpiCard
              label="Présents aujourd'hui"
              value={data.counters.presentToday}
              icon={Clock4}
              accent="green"
              href="/attendance"
            />
            <KpiCard
              label="Absents aujourd'hui"
              value={data.counters.absentToday}
              icon={UserX}
              accent={absentCount > 0 ? 'red' : 'neutral'}
              href="/attendance"
            />
            <KpiCard
              label="Retards"
              value={data.counters.lateToday ?? 0}
              icon={AlertCircle}
              accent={lateCount > 0 ? 'amber' : 'neutral'}
              href="/attendance"
            />
          </div>
        </div>

        {/* ── KPIs RH ───────────────────────────────────────────────────────── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-mutedText">RH & Opérations</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Heures cette semaine"
              value={data.counters.weeklyHours}
              icon={Timer}
              accent="blue"
            />
            <KpiCard
              label="Timesheets à valider"
              value={data.counters.pendingTimesheets}
              icon={ClipboardList}
              accent={pendingTS > 0 ? 'amber' : 'neutral'}
              href="/timesheets"
            />
            <KpiCard
              label="Congés en attente"
              value={data.counters.pendingLeave}
              icon={CalendarClock}
              accent={pendingLeave > 0 ? 'violet' : 'neutral'}
              href="/time-off/requests"
            />
            <KpiCard
              label="Chantiers actifs"
              value={data.counters.activeSites}
              icon={Building2}
              accent="neutral"
              href="/sites"
            />
          </div>
        </div>

        {/* ── Graphiques analytiques ───────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Donut — Présence du jour */}
          <div className="rounded-xl border border-borderSoft bg-surface p-5 shadow-card">
            <p className="mb-4 text-sm font-semibold text-bodyText">Présence du jour</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Présents',  value: Number(data.counters.presentToday) || 0 },
                      { name: 'Absents',   value: Number(data.counters.absentToday)  || 0 },
                      { name: 'Retards',   value: Number(data.counters.lateToday)    || 0 },
                    ]}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}`, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-2 flex-1">
                {[
                  { label: 'Présents',  value: Number(data.counters.presentToday) || 0, color: '#22c55e' },
                  { label: 'Absents',   value: Number(data.counters.absentToday)  || 0, color: '#ef4444' },
                  { label: 'Retards',   value: Number(data.counters.lateToday)    || 0, color: '#f59e0b' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-mutedText">{item.label}</span>
                    </div>
                    <span className="font-semibold text-bodyText">{item.value}</span>
                  </div>
                ))}
                <div className="mt-1 border-t border-borderSoft pt-2 flex items-center justify-between text-sm">
                  <span className="text-mutedText">Total</span>
                  <span className="font-bold text-bodyText">{Number(data.counters.activeEmployees) || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bar chart — Pointages cette semaine */}
          <div className="rounded-xl border border-borderSoft bg-surface p-5 shadow-card">
            <p className="mb-4 text-sm font-semibold text-bodyText">Pointages — 7 derniers jours</p>
            {(() => {
              const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d;
              });
              const chartData = days.map((d) => {
                const iso = d.toISOString().slice(0, 10);
                const dayPunches = (data.latestPunches as Array<Record<string, unknown>>).filter(
                  (p) => String(p.punchDate ?? '').slice(0, 10) === iso,
                );
                return {
                  day: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
                  présents: dayPunches.length,
                };
              });
              return (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} barSize={24}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                    <Tooltip
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="présents" fill="#3563e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>

        {/* ── Derniers pointages ────────────────────────────────────────────── */}
        <section className="grid gap-3">
          <SectionHeader title="Derniers pointages" href="/attendance" />
          <DataTable columns={punchColumns} data={data.latestPunches} pageSize={5} />
        </section>

        {/* ── Congés en attente ─────────────────────────────────────────────── */}
        {data.pendingLeaveRequests.length > 0 && (
          <section className="grid gap-3">
            <SectionHeader
              title="Demandes de congé à traiter"
              href="/time-off/requests"
              count={data.pendingLeaveRequests.length}
            />
            <DataTable columns={leaveColumns} data={data.pendingLeaveRequests} pageSize={5} />
          </section>
        )}

        {/* ── Timesheets à approuver ────────────────────────────────────────── */}
        {data.timesheetsToApprove.length > 0 && (
          <section className="grid gap-3">
            <SectionHeader
              title="Timesheets à approuver"
              href="/timesheets"
              count={data.timesheetsToApprove.length}
            />
            <DataTable columns={tsColumns} data={data.timesheetsToApprove} pageSize={5} />
          </section>
        )}

      </div>
    </AppShell>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const myRole = tokenStore.session?.role ?? '';
  return myRole === 'EMPLOYEE' ? <EmployeeDashboard /> : <AdminDashboard />;
}
