'use client';

import { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Shield } from 'lucide-react';
import { AppShell }    from '@/components/layout/app-shell';
import { PageHeader }  from '@/components/layout/page-header';
import { DataTable }   from '@/components/ui/data-table';
import { FormField }   from '@/components/ui/form-fields';
import { api }         from '@/lib/api-client';
import { useApiData }  from '@/lib/use-api-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
};

// ─── Action labels ────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  login:                      'bg-green-100 text-green-700',
  logout:                     'bg-gray-100  text-gray-600',
  'attendance.check_in':      'bg-blue-100  text-blue-700',
  'attendance.check_out':     'bg-blue-100  text-blue-700',
  'attendance.approve':       'bg-green-100 text-green-700',
  'attendance.reject':        'bg-red-100   text-red-700',
  'leave.approve':            'bg-green-100 text-green-700',
  'leave.reject':             'bg-red-100   text-red-700',
  'timesheet.approve':        'bg-green-100 text-green-700',
  'timesheet.reject':         'bg-red-100   text-red-700',
  'auth.forgot_password':     'bg-amber-100 text-amber-700',
  'auth.reset_password':      'bg-amber-100 text-amber-700',
  'employee.create':          'bg-violet-100 text-violet-700',
  'employee.update':          'bg-violet-100 text-violet-700',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {action}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [search, setSearch]       = useState('');
  const [actionFilter, setAction] = useState('');
  const [entityFilter, setEntity] = useState('');

  const { data: logs, loading } = useApiData<AuditLog[]>(
    () => api.auditLogs(200) as Promise<AuditLog[]>,
    [],
  );

  const allActions  = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs]);
  const allEntities = useMemo(() => [...new Set(logs.map((l) => l.entityType))].sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter((l) => {
      if (actionFilter && l.action !== actionFilter) return false;
      if (entityFilter && l.entityType !== entityFilter) return false;
      if (q) {
        const userStr = l.user ? `${l.user.firstName} ${l.user.lastName} ${l.user.email}` : '';
        const str = `${l.action} ${l.entityType} ${l.entityId ?? ''} ${userStr}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, entityFilter]);

  const columns: ColumnDef<AuditLog, unknown>[] = [
    {
      header: 'Date',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-mutedText">
          {new Date(row.original.createdAt).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: ({ row }) => <ActionBadge action={row.original.action} />,
    },
    {
      header: 'Entité',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-bodyText">
          {row.original.entityType}
          {row.original.entityId && (
            <span className="ml-1 font-mono text-hintText text-[10px]">
              #{row.original.entityId.slice(-6)}
            </span>
          )}
        </span>
      ),
    },
    {
      header: 'Utilisateur',
      cell: ({ row }) => row.original.user ? (
        <div>
          <p className="text-xs font-medium text-bodyText">
            {row.original.user.firstName} {row.original.user.lastName}
          </p>
          <p className="text-[10px] text-mutedText">{row.original.user.email}</p>
        </div>
      ) : <span className="text-xs text-hintText">Système</span>,
    },
    {
      header: 'Détails',
      cell: ({ row }) => {
        const meta = row.original.metadata;
        if (!meta || Object.keys(meta).length === 0) return <span className="text-hintText text-xs">—</span>;
        const preview = Object.entries(meta).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ');
        return (
          <span className="text-[11px] text-mutedText font-mono" title={JSON.stringify(meta, null, 2)}>
            {preview}
          </span>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Journal d'audit"
          description="Historique complet de toutes les actions effectuées sur la plateforme."
        />

        {/* Statistiques rapides */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: 'Total événements', value: logs.length,                              color: 'text-bodyText' },
            { label: 'Aujourd\'hui',      value: logs.filter((l) => l.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, color: 'text-blue-600' },
            { label: 'Actions critiques', value: logs.filter((l) => l.action.includes('reject') || l.action.includes('reset')).length, color: 'text-red-600' },
            { label: 'Filtrés',           value: filtered.length,                          color: 'text-accent' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-borderSoft bg-surface px-4 py-3 shadow-card">
              <p className="text-xs text-mutedText">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="grid gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card md:grid-cols-3">
          <FormField
            label="Recherche"
            placeholder="Action, utilisateur, entité…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-bodyText">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setAction(e.target.value)}
              className="h-9 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
            >
              <option value="">Toutes les actions</option>
              {allActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-bodyText">Type d'entité</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntity(e.target.value)}
              className="h-9 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
            >
              <option value="">Toutes les entités</option>
              {allEntities.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-mutedText">
            Chargement des logs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center gap-2 rounded-xl border border-borderSoft bg-surface text-sm text-mutedText shadow-card">
            <Shield className="h-4 w-4" />
            Aucun événement correspondant aux filtres.
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} pageSize={25} />
        )}
      </div>
    </AppShell>
  );
}
