'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  MapPin, Clock4, CheckCircle2, XCircle, AlertTriangle,
  Filter, RefreshCw,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { AttendanceCard } from '@/components/domain/attendance-card';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SecondaryButton, DangerButton } from '@/components/ui/buttons';
import { DateField, SelectField } from '@/components/ui/form-fields';
import { api, tokenStore } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';
import { fmtDate, fmtTime, fmtDuration } from '@/lib/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

type Punch = {
  id: string;
  punchDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number | null;
  workLocation: string;
  isGpsAnomaly: boolean;
  employeeComment: string | null;
  managerComment: string | null;
  status: string;
  site: { id: string; code: string; name: string } | null;
  user: { id: string; firstName: string; lastName: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORK_LOCATION_LABELS: Record<string, string> = {
  SITE: 'Site', OFFICE: 'Bureau', HOME: 'Domicile', TRAVEL: 'Déplacement',
};

const MANAGER_ROLES = ['RESOURCE_MANAGER', 'HR', 'PROJECT_MANAGER', 'MANAGER'];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const role      = tokenStore.session?.role ?? '';
  const isManager = MANAGER_ROLES.includes(role);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');

  const { data: punches, loading, error, refresh } = useApiData<Punch[]>(
    () => api.attendance() as Promise<Punch[]>,
    [],
  );

  // Filtrage côté client
  const filtered = punches.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (dateFrom && p.punchDate.slice(0, 10) < dateFrom) return false;
    if (dateTo   && p.punchDate.slice(0, 10) > dateTo)   return false;
    return true;
  });

  // KPIs semaine courante
  const thisWeekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const weekPunches = punches.filter((p) => p.punchDate.slice(0, 10) >= thisWeekStart);
  const totalHours  = weekPunches.reduce((s, p) => s + (p.durationMinutes ?? 0), 0) / 60;
  const pending     = punches.filter((p) => p.status === 'SUBMITTED').length;
  const anomalies   = punches.filter((p) => p.isGpsAnomaly).length;

  // Actions manager
  async function handleApprove(id: string) {
    await api.approveAttendance(id);
    refresh();
  }
  async function handleReject(id: string) {
    await api.rejectAttendance(id, 'Refusé par le manager');
    refresh();
  }

  // ── Colonnes ─────────────────────────────────────────────────────────────

  const columns: ColumnDef<Punch, unknown>[] = [
    ...(isManager ? [{
      header: 'Employé',
      cell: ({ row }: { row: { original: Punch } }) => {
        const u = row.original.user;
        return u
          ? <span className="font-medium text-bodyText">{u.firstName} {u.lastName}</span>
          : <span className="text-hintText">—</span>;
      },
    } as ColumnDef<Punch, unknown>] : []),
    {
      header: 'Date',
      accessorKey: 'punchDate',
      cell: ({ row }) => (
        <span className="capitalize whitespace-nowrap text-sm text-bodyText">
          {fmtDate(row.original.punchDate)}
        </span>
      ),
    },
    {
      header: 'Site',
      cell: ({ row }) => row.original.site
        ? (
          <span className="flex items-center gap-1 text-sm text-mutedText">
            <MapPin className="h-3 w-3 shrink-0 text-accent" />
            {row.original.site.code} — {row.original.site.name}
          </span>
        )
        : <span className="text-hintText text-sm">—</span>,
    },
    {
      header: 'Lieu',
      cell: ({ row }) => (
        <span className="text-sm text-mutedText">
          {WORK_LOCATION_LABELS[row.original.workLocation] ?? row.original.workLocation}
        </span>
      ),
    },
    {
      header: 'Entrée',
      cell: ({ row }) => (
        <span className="text-sm font-mono text-bodyText">
          {row.original.checkInAt ? fmtTime(row.original.checkInAt) : '—'}
        </span>
      ),
    },
    {
      header: 'Sortie',
      cell: ({ row }) => (
        <span className="text-sm font-mono">
          {row.original.checkOutAt
            ? <span className="text-bodyText">{fmtTime(row.original.checkOutAt)}</span>
            : row.original.checkInAt
              ? <span className="font-medium text-accent">En cours</span>
              : <span className="text-hintText">—</span>
          }
        </span>
      ),
    },
    {
      header: 'Durée',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-bodyText">
          {fmtDuration(row.original.durationMinutes)}
        </span>
      ),
    },
    {
      header: 'Statut',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.original.status} />
          {row.original.isGpsAnomaly && (
            <span title="Anomalie GPS">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </span>
          )}
        </div>
      ),
    },
    ...(isManager ? [{
      header: 'Actions',
      cell: ({ row }: { row: { original: Punch } }) => {
        const p = row.original;
        if (p.status !== 'SUBMITTED') return null;
        return (
          <div className="flex items-center gap-2">
            <ConfirmDialog
              title="Approuver le pointage"
              description={`Confirmer l'approbation du pointage du ${fmtDate(p.punchDate)} ?`}
              confirmLabel="Approuver"
              onConfirm={() => handleApprove(p.id)}
              trigger={
                <SecondaryButton type="button" className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                </SecondaryButton>
              }
            />
            <ConfirmDialog
              title="Refuser le pointage"
              description={`Refuser le pointage du ${fmtDate(p.punchDate)} ?`}
              confirmLabel="Refuser"
              onConfirm={() => handleReject(p.id)}
              trigger={
                <DangerButton type="button" className="h-7 px-2 text-xs">
                  <XCircle className="h-3.5 w-3.5" /> Refuser
                </DangerButton>
              }
            />
          </div>
        );
      },
    } as ColumnDef<Punch, unknown>] : []),
  ];

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <AppShell loading={loading} skeletonProps={{ kpis: 4, tableRows: 8, tableCols: isManager ? 9 : 8 }}>
      <div className="grid gap-5">

        <PageHeader
          title="Pointage"
          description={isManager
            ? 'Suivi des présences et validation des pointages de votre équipe.'
            : 'Enregistrez vos entrées / sorties et suivez votre historique de présence.'
          }
        />

        {/* Widget check-in/out — employés uniquement */}
        {!isManager && (
          <div className="max-w-md">
            <AttendanceCard />
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Heures cette semaine',
              value: `${totalHours.toFixed(1)} h`,
              icon: Clock4,
              color: 'text-blue-600',
              bg: 'bg-blue-50 border-blue-100',
            },
            {
              label: 'Jours pointés (sem.)',
              value: weekPunches.length,
              icon: MapPin,
              color: 'text-green-600',
              bg: 'bg-green-50 border-green-100',
            },
            {
              label: 'En attente validation',
              value: pending,
              icon: AlertTriangle,
              color: pending   > 0 ? 'text-amber-600' : 'text-mutedText',
              bg:    pending   > 0 ? 'bg-amber-50 border-amber-100' : 'bg-surface border-borderSoft',
            },
            {
              label: 'Anomalies GPS',
              value: anomalies,
              icon: AlertTriangle,
              color: anomalies > 0 ? 'text-red-600' : 'text-mutedText',
              bg:    anomalies > 0 ? 'bg-red-50 border-red-100' : 'bg-surface border-borderSoft',
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl border p-4 shadow-card ${bg}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-mutedText leading-tight">{label}</p>
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Historique */}
        <section className="grid gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold text-bodyText">
              {isManager ? 'Pointages équipe' : 'Mon historique'}
            </h2>
            <div className="flex flex-wrap items-end gap-2">
              <Filter className="mb-2 h-4 w-4 shrink-0 text-mutedText" />
              <div className="w-36">
                <DateField label="Du" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="w-36">
                <DateField label="Au" value={dateTo}   onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="w-40">
                <SelectField label="Statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">Tous les statuts</option>
                  <option value="DRAFT">Brouillon</option>
                  <option value="SUBMITTED">En attente</option>
                  <option value="APPROVED">Approuvé</option>
                  <option value="REJECTED">Refusé</option>
                </SelectField>
              </div>
              <button
                onClick={refresh}
                title="Actualiser"
                className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-borderSoft bg-surface text-mutedText hover:bg-surfaceHover transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
              Erreur de chargement : {error}
            </div>
          )}

          <DataTable columns={columns} data={filtered} pageSize={15} />
        </section>

      </div>
    </AppShell>
  );
}
