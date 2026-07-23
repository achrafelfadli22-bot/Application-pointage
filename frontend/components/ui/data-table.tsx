'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from './states';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pageSize?: number;
  getRowHref?: (row: TData) => string | undefined;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData>({
  columns,
  data,
  pageSize = 10,
  getRowHref,
  onRowClick,
}: DataTableProps<TData>) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    initialState: { pagination: { pageSize } },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!data.length) {
    return <EmptyState title="Aucun résultat" description="Les données apparaîtront ici." />;
  }

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const totalRows = data.length;
  const firstRow  = pageIndex * currentPageSize + 1;
  const lastRow   = Math.min(firstRow + currentPageSize - 1, totalRows);
  const pageCount = table.getPageCount();

  return (
    <div className="grid gap-0 overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-borderSoft bg-grayCard">
              {table.getHeaderGroups().flatMap((hg) =>
                hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mutedText ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-bodyText' : ''}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          header.column.getIsSorted() === 'asc'  ? <ChevronUp   className="h-3 w-3 text-accent" /> :
                          header.column.getIsSorted() === 'desc' ? <ChevronDown className="h-3 w-3 text-accent" /> :
                          <ChevronsUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-borderSoft">
            {table.getRowModel().rows.map((row) => {
              const href = getRowHref?.(row.original);
              const isClickable = Boolean(href || onRowClick);
              const openRow = () => {
                if (href) router.push(href);
                else onRowClick?.(row.original);
              };
              return (
              <tr
                key={row.id}
                tabIndex={isClickable ? 0 : undefined}
                role={href ? 'link' : isClickable ? 'button' : undefined}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('a,button,input,select,textarea')) return;
                  openRow();
                }}
                onKeyDown={(event) => {
                  if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openRow();
                  }
                }}
                className={`transition-colors hover:bg-surfaceHover ${isClickable ? 'cursor-pointer focus:bg-surfaceHover focus:outline-none' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-4 py-3 text-sm text-bodyText"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Contrôles de pagination — masqués si tout tient sur une page */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-borderSoft px-4 py-3">
          {/* Compteur */}
          <p className="text-xs text-mutedText">
            {firstRow}–{lastRow} sur {totalRows} résultat{totalRows !== 1 ? 's' : ''}
          </p>

          {/* Navigation pages */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-borderSoft text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: pageCount }, (_, i) => i).map((i) => {
              const show =
                i === 0 ||
                i === pageCount - 1 ||
                Math.abs(i - pageIndex) <= 1;
              if (!show) return null;
              const showEllipsisBefore = i === pageCount - 1 && pageIndex < pageCount - 3;
              const showEllipsisAfter  = i === 0 && pageIndex > 2;
              return (
                <span key={i} className="flex items-center">
                  {showEllipsisAfter && (
                    <span className="px-1 text-xs text-hintText">…</span>
                  )}
                  <button
                    type="button"
                    onClick={() => table.setPageIndex(i)}
                    className={`flex h-7 min-w-[28px] items-center justify-center rounded-md px-1 text-xs font-medium transition-colors ${
                      i === pageIndex
                        ? 'bg-accentLight text-accentText'
                        : 'text-mutedText hover:bg-surfaceHover hover:text-bodyText'
                    }`}
                  >
                    {i + 1}
                  </button>
                  {showEllipsisBefore && (
                    <span className="px-1 text-xs text-hintText">…</span>
                  )}
                </span>
              );
            })}

            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-borderSoft text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Taille de page */}
          <select
            value={currentPageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-7 rounded-md border border-borderSoft bg-surface px-2 text-xs text-bodyText outline-none focus:border-accent"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
