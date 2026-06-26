'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TimesheetGrid } from '@/components/domain/timesheet-grid';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type TEntry = { entryDate: string; hours: number; comment?: string };
type TLine = {
  taskName: string;
  billingType: string;
  activity: string;
  workLocation: string;
  placeOfWork: string;
  site?: {
    id: string;
    code: string;
    name: string;
    project?: { id: string; code: string; name: string } | null;
  } | null;
  entries: TEntry[];
};
type Timesheet = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  rejectionReason?: string | null;
  permissions?: { canEdit?: boolean };
  user: { id: string; firstName: string; lastName: string };
  approvedBy?: { firstName: string; lastName: string } | null;
  lines: TLine[];
};

const fallback: Timesheet = {
  id: '',
  periodStart: new Date().toISOString(),
  periodEnd: new Date().toISOString(),
  status: 'DRAFT',
  permissions: { canEdit: false },
  user: { id: '', firstName: '', lastName: '' },
  lines: [],
};

function employeeName(user: Timesheet['user']) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

function formatPeriod(start?: string, end?: string) {
  if (!start || !end) return '';
  return `${new Date(start).toLocaleDateString('fr-FR')} - ${new Date(end).toLocaleDateString('fr-FR')}`;
}

export default function TimesheetDetailPage() {
  const params = useParams<{ id: string }>();
  const timesheetId = params?.id ?? '';
  const { data, loading, error, refresh } = useApiData<Timesheet>(
    () => api.timesheet(timesheetId) as Promise<Timesheet>,
    fallback,
  );
  const name = employeeName(data.user);
  const period = formatPeriod(data.periodStart, data.periodEnd);

  return (
    <AppShell>
      <div className="grid gap-6">
        <div>
          <Link href="/timesheets" className="mb-3 inline-flex items-center gap-1 text-sm text-mutedText hover:text-bodyText">
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour aux feuilles de temps
          </Link>
          <PageHeader
            title={name ? `Feuille de temps - ${name}` : 'Detail feuille de temps'}
            description={period ? `Periode : ${period}` : 'Chargement...'}
          />
        </div>

        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {!loading && data.id && <TimesheetGrid timesheet={data} onRefresh={refresh} />}
      </div>
    </AppShell>
  );
}
