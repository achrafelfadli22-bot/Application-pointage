import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// ── Base pulse block ──────────────────────────────────────────────────────────

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200/80',
        className,
      )}
      style={style}
    />
  );
}

// ── KPI card skeleton (matches the 4-col grid used in most pages) ─────────────

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-borderSoft bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-7 w-16" />
    </div>
  );
}

export function KpiGridSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-${cols}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <div className="flex gap-4 border-b border-borderSoft py-3 px-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3.5 flex-1" style={{ opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
      {/* Header */}
      <div className="flex gap-4 border-b border-borderSoft bg-grayCard py-3 px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} cols={cols} />
      ))}
    </div>
  );
}

// ── Page skeleton (header + KPIs + table) ─────────────────────────────────────

export function PageSkeleton({ kpis = 4, tableRows = 8, tableCols = 5 }: {
  kpis?: number;
  tableRows?: number;
  tableCols?: number;
}) {
  return (
    <div className="grid gap-5">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      {/* KPIs */}
      <KpiGridSkeleton cols={kpis} />
      {/* Table */}
      <TableSkeleton rows={tableRows} cols={tableCols} />
    </div>
  );
}
