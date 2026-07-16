'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { BookingModal } from '@/components/domain/booking-modal';
import { TimeOffCalendar, type TimeOffCalendarEvent } from '@/components/domain/time-off-calendar';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SelectField } from '@/components/ui/form-fields';
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
  const myRole = tokenStore.session?.role ?? '';
  const canManageRequests = ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'].includes(myRole);
  const [selectedUserId, setSelectedUserId] = useState(sessionUser?.id ?? '');

  const { data: balances } = useApiData<Balance[]>(
    () => api.leaveBalances() as Promise<Balance[]>,
    [],
  );

  const { data: leaves } = useApiData<LeaveRequest[]>(
    () => api.leaveRequests() as Promise<LeaveRequest[]>,
    [],
  );

  const { data: employees } = useApiData<Employee[]>(
    () => (canManageRequests ? api.employees() as Promise<Employee[]> : Promise.resolve([])),
    [],
  );

  const people = useMemo(() => {
    const byId = new Map<string, CalendarPerson>();

    if (sessionUser) {
      byId.set(sessionUser.id, {
        id: sessionUser.id,
        name: sessionUser.fullName || fullName(sessionUser),
        email: sessionUser.email,
      });
    }

    if (canManageRequests) {
      for (const employee of employees) {
        if (employee.status !== 'ACTIVE') continue;
        byId.set(employee.user.id, {
          id: employee.user.id,
          name: fullName(employee.user),
          email: employee.user.email,
        });
      }

      for (const leave of leaves) {
        byId.set(leave.user.id, {
          id: leave.user.id,
          name: fullName(leave.user),
          email: leave.user.email,
        });
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [canManageRequests, employees, leaves, sessionUser]);

  useEffect(() => {
    if (selectedUserId && people.some((person) => person.id === selectedUserId)) {
      return;
    }
    setSelectedUserId(sessionUser?.id ?? people[0]?.id ?? '');
  }, [people, selectedUserId, sessionUser?.id]);

  const selectedPerson = people.find((person) => person.id === selectedUserId);
  const selectedLeaves = leaves.filter((leave) => leave.user.id === selectedUserId);

  const calendarEvents: TimeOffCalendarEvent[] = selectedLeaves.flatMap((leave) =>
    expandDates(leave.startDate, leave.endDate).map((date) => ({
      date,
      label: leave.leaveType?.name ?? 'Conge',
      status: leave.status,
    })),
  );

  const currentYear = new Date().getFullYear();
  const personBalances = balances.filter((balance) => !selectedUserId || balance.user?.id === selectedUserId);
  const deduped = Object.values(
    personBalances.reduce<Record<string, Balance>>((acc, balance) => {
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
          description="Soldes, calendrier personnel et demandes de congés."
          actions={
            <div className="flex items-center gap-2">
              {canManageRequests && (
                <Link
                  href="/time-off/requests"
                  className="flex h-9 items-center gap-2 rounded-lg border border-borderSoft bg-surface px-3 text-sm font-medium text-bodyText shadow-card transition-colors hover:bg-surfaceHover"
                >
                  <ClipboardList className="h-4 w-4 text-hintText" />
                  Gerer les demandes
                </Link>
              )}
              <BookingModal />
            </div>
          }
        />

        {canManageRequests && people.length > 0 && (
          <div className="rounded-xl border border-borderSoft bg-surface p-4 shadow-card">
            <SelectField
              label="Calendrier de"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}{person.email ? ` - ${person.email}` : ''}
                </option>
              ))}
            </SelectField>
          </div>
        )}

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
