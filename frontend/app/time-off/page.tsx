'use client';

import { BookingModal } from '@/components/domain/booking-modal';
import { TimeOffCalendar, type TimeOffCalendarEvent } from '@/components/domain/time-off-calendar';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { api, tokenStore } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

type Balance = {
  year: number;
  leaveType: { name: string };
  user?: { id: string; firstName: string; lastName: string; email: string };
  usedDays: number | string;
  pendingDays: number | string;
  remainingDays: number | string;
  openingBalance: number | string;
  accruedDays: number | string;
};

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  leaveType: { name: string };
};

type Employee = {
  id: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email?: string; role: string };
};

type CalendarPerson = {
  id: string;
  name: string;
  email?: string;
};

function expandDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(cur.toISOString().slice(0, 10));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function fullName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export default function TimeOffPage() {
  const sessionUser = tokenStore.session?.user;

  const { data: balances } = useApiData<Balance[]>(
    () => api.leaveBalances() as Promise<Balance[]>,
    [],
  );

  const { data: leaves } = useApiData<LeaveRequest[]>(
    () => api.leaveRequests('mine') as Promise<LeaveRequest[]>,
    [],
  );

  const selectedPerson = sessionUser
    ? { id: sessionUser.id, name: sessionUser.fullName || fullName(sessionUser), email: sessionUser.email }
    : undefined;

  const calendarEvents: TimeOffCalendarEvent[] = leaves.flatMap((leave) =>
    expandDates(leave.startDate, leave.endDate).map((date) => ({
      date,
      label: leave.leaveType?.name ?? 'Conge',
      status: leave.status,
    })),
  );

  const currentYear = new Date().getFullYear();
  const deduped = Object.values(
    balances.reduce<Record<string, Balance>>((acc, balance) => {
      const key = balance.leaveType.name;
      if (!acc[key] || balance.year > acc[key]!.year) acc[key] = balance;
      return acc;
    }, {}),
  ).filter((balance) => balance.year === currentYear || balance.year === currentYear - 1);

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Conges"
          description="Mes soldes, mon calendrier et mes demandes de congé."
          actions={<BookingModal />}
        />

        {deduped.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
            <div className="border-b border-borderSoft px-5 py-3">
              <p className="text-sm font-semibold text-bodyText">
                Soldes de congés - {selectedPerson?.name ?? 'Moi'} - {currentYear}
              </p>
            </div>
            <div className="divide-y divide-borderSoft">
              {deduped.map((balance) => (
                <div key={`${balance.leaveType.name}-${balance.year}`} className="grid grid-cols-4 items-center gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-bodyText">{balance.leaveType.name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-mutedText">Acquis</p>
                    <p className="mt-0.5 text-lg font-semibold text-bodyText">
                      {Number(balance.openingBalance) + Number(balance.accruedDays)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-mutedText">Pris / En attente</p>
                    <p className="mt-0.5 text-sm text-bodyText">
                      {Number(balance.usedDays)} j / {Number(balance.pendingDays)} j
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-mutedText">Solde restant</p>
                    <p className="mt-0.5 text-2xl font-semibold text-accent">
                      {Number(balance.remainingDays)} j
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <TimeOffCalendar events={calendarEvents} ownerName={selectedPerson?.name ?? 'Mon calendrier'} />
      </div>
    </AppShell>
  );
}
