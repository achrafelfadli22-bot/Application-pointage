'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

// ─── Types ────────────────────────────────────────────────────────────────────

type Punch = {
  id: string;
  punchDate: string;
  checkInAt: string | null;
  durationMinutes: number | null;
  status: string;
  isGpsAnomaly: boolean;
  user: { id: string; firstName: string; lastName: string };
};

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  user: { id: string };
  leaveType: { name: string };
};

type Employee = {
  id: string;
  jobTitle: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; role: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day  = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - ((day + 6) % 7));
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

type DayStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'WEEKEND' | 'FUTURE';

function getStatusStyle(s: DayStatus): { bg: string; text: string; label: string } {
  switch (s) {
    case 'PRESENT': return { bg: 'bg-green-100 border-green-300',  text: 'text-green-700',  label: 'Présent' };
    case 'LATE':    return { bg: 'bg-amber-100 border-amber-300',  text: 'text-amber-700',  label: 'Retard' };
    case 'ABSENT':  return { bg: 'bg-red-50 border-red-200',       text: 'text-red-500',    label: 'Absent' };
    case 'LEAVE':   return { bg: 'bg-blue-100 border-blue-200',    text: 'text-blue-700',   label: 'Congé' };
    case 'WEEKEND': return { bg: 'bg-surface border-borderSoft',   text: 'text-hintText',   label: '—' };
    case 'FUTURE':  return { bg: 'bg-surface border-borderSoft',   text: 'text-hintText',   label: '' };
    default:        return { bg: 'bg-surface border-borderSoft',   text: 'text-mutedText',  label: '?' };
  }
}

// ─── Demo fallbacks ───────────────────────────────────────────────────────────

const demoEmployees: Employee[] = [
  { id: 'e1', jobTitle: 'Maçon', status: 'ACTIVE', user: { id: 'u1', firstName: 'Omar', lastName: 'Mansouri', role: 'EMPLOYEE' } },
  { id: 'e2', jobTitle: 'Chef chantier', status: 'ACTIVE', user: { id: 'u2', firstName: 'Karim', lastName: 'Benali', role: 'MANAGER' } },
  { id: 'e3', jobTitle: 'Électricien', status: 'ACTIVE', user: { id: 'u3', firstName: 'Fatima', lastName: 'Zahraoui', role: 'EMPLOYEE' } },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd  = weekDays[6]!;

  const { data: employees } = useApiData<Employee[]>(
    () => api.employees() as Promise<Employee[]>,
    demoEmployees,
  );

  const { data: punches } = useApiData<Punch[]>(
    () => api.attendance() as Promise<Punch[]>,
    [],
  );

  const { data: leaves } = useApiData<LeaveRequest[]>(
    () => api.leaveRequests() as Promise<LeaveRequest[]>,
    [],
  );

  const today   = new Date();
  const todayIso = isoDate(today);

  // Determine cell status for each employee × day
  function getCellStatus(emp: Employee, day: Date): { status: DayStatus; hours?: string; leaveType?: string } {
    const iso     = isoDate(day);
    const dayOfWeek = day.getUTCDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture  = iso > todayIso;

    if (isWeekend) return { status: 'WEEKEND' };
    if (isFuture)  return { status: 'FUTURE' };

    // Check approved leave
    const onLeave = leaves.find((l) =>
      l.user.id === emp.user.id &&
      l.status === 'APPROVED' &&
      iso >= l.startDate.slice(0, 10) &&
      iso <= l.endDate.slice(0, 10),
    );
    if (onLeave) return { status: 'LEAVE', leaveType: onLeave.leaveType.name };

    // Check punch
    const punch = punches.find(
      (p) => p.user.id === emp.user.id && p.punchDate.slice(0, 10) === iso,
    );
    if (!punch) return { status: 'ABSENT' };

    // Determine late (check-in after 08:15)
    const isLate = punch.checkInAt
      ? new Date(punch.checkInAt).getUTCHours() * 60 + new Date(punch.checkInAt).getUTCMinutes() > 8 * 60 + 15
      : false;

    const hours = punch.durationMinutes
      ? `${(punch.durationMinutes / 60).toFixed(1)}h`
      : punch.checkInAt ? 'En cours' : '';

    return { status: isLate ? 'LATE' : 'PRESENT', hours };
  }

  function prevWeek() { setWeekStart((d) => addDays(d, -7)); }
  function nextWeek() { setWeekStart((d) => addDays(d, 7)); }
  function goToday()  { setWeekStart(startOfWeek(new Date())); }

  const isCurrentWeek = isoDate(weekStart) === isoDate(startOfWeek(new Date()));

  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE');

  // Stats de la semaine
  const weekStats = (() => {
    let present = 0, absent = 0, leave = 0, late = 0;
    for (const emp of activeEmployees) {
      for (let i = 0; i < 5; i++) { // lun-ven only
        const day = weekDays[i]!;
        const { status } = getCellStatus(emp, day);
        if (status === 'PRESENT') present++;
        else if (status === 'ABSENT') absent++;
        else if (status === 'LEAVE') leave++;
        else if (status === 'LATE') late++;
      }
    }
    return { present, absent, leave, late };
  })();

  const weekLabel = `${weekDays[0]!.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Planning équipe"
          description="Présence, retards, absences et congés — vue hebdomadaire."
        />

        {/* Navigation semaine */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevWeek}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-borderSoft bg-surface text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[240px] text-center text-sm font-semibold text-bodyText">{weekLabel}</span>
            <button
              type="button"
              onClick={nextWeek}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-borderSoft bg-surface text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-borderSoft bg-surface px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accentLight"
              >
                Aujourd'hui
              </button>
            )}
          </div>

          {/* Légende + stats */}
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: `${weekStats.present} présent(s)`,  bg: 'bg-green-100', text: 'text-green-700' },
              { label: `${weekStats.late} retard(s)`,      bg: 'bg-amber-100', text: 'text-amber-700' },
              { label: `${weekStats.absent} absent(s)`,    bg: 'bg-red-50',    text: 'text-red-500' },
              { label: `${weekStats.leave} congé(s)`,      bg: 'bg-blue-100',  text: 'text-blue-700' },
            ].map((s) => (
              <span key={s.label} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Grille */}
        <div className="overflow-x-auto rounded-xl border border-borderSoft bg-surface shadow-card">
          <table className="w-full border-collapse text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="border-b border-borderSoft bg-grayCard">
                {/* Col employé */}
                <th className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-mutedText">
                  Employé
                </th>
                {weekDays.map((day, i) => {
                  const iso   = isoDate(day);
                  const isToday = iso === todayIso;
                  const isWE   = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                  return (
                    <th
                      key={iso}
                      className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                        isWE ? 'text-hintText' : isToday ? 'text-accentText' : 'text-mutedText'
                      }`}
                    >
                      <div className={isToday ? 'font-bold' : ''}>{DAYS_FR[i]}</div>
                      <div className={`mt-0.5 text-[11px] ${isToday ? 'font-bold text-accentText' : 'text-hintText'}`}>
                        {day.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSoft">
              {activeEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-mutedText">
                    Aucun employé actif.
                  </td>
                </tr>
              ) : (
                activeEmployees.map((emp) => (
                  <tr key={emp.id} className="transition-colors hover:bg-surfaceHover/50">
                    {/* Employé */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accentLight text-[10px] font-semibold text-accentText">
                          {emp.user.firstName[0]}{emp.user.lastName[0]}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-bodyText">
                            {emp.user.firstName} {emp.user.lastName}
                          </div>
                          <div className="text-[10px] text-mutedText">{emp.jobTitle}</div>
                        </div>
                      </div>
                    </td>
                    {/* Jours */}
                    {weekDays.map((day) => {
                      const iso = isoDate(day);
                      const { status, hours, leaveType } = getCellStatus(emp, day);
                      const style = getStatusStyle(status);
                      return (
                        <td key={iso} className="px-1.5 py-1.5 text-center">
                          {status === 'WEEKEND' || status === 'FUTURE' ? (
                            <div className={`mx-auto flex h-10 w-full max-w-[70px] items-center justify-center rounded-md border text-[10px] ${style.bg} ${style.text}`}>
                              {status === 'WEEKEND' ? '—' : ''}
                            </div>
                          ) : (
                            <div
                              className={`mx-auto flex h-10 w-full max-w-[70px] flex-col items-center justify-center rounded-md border text-[10px] font-semibold ${style.bg} ${style.text}`}
                            >
                              <span>{leaveType ? '✈' : style.label}</span>
                              {hours && <span className="text-[9px] font-normal opacity-80">{hours}</span>}
                              {leaveType && <span className="text-[9px] font-normal opacity-80 truncate w-full text-center px-1">{leaveType}</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Légende */}
        <div className="flex flex-wrap gap-4 text-xs text-mutedText">
          {[
            { label: 'Présent', bg: 'bg-green-100 border-green-300', text: 'text-green-700' },
            { label: 'Retard',  bg: 'bg-amber-100 border-amber-300', text: 'text-amber-700' },
            { label: 'Absent',  bg: 'bg-red-50 border-red-200',      text: 'text-red-500' },
            { label: 'Congé',   bg: 'bg-blue-100 border-blue-200',   text: 'text-blue-700' },
            { label: 'Week-end',bg: 'bg-surface border-borderSoft',   text: 'text-hintText' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-flex h-4 w-8 items-center justify-center rounded border text-[9px] font-semibold ${l.bg} ${l.text}`}>
                {l.label === 'Présent' ? '✓' : l.label === 'Absent' ? '✗' : l.label === 'Congé' ? '✈' : l.label === 'Retard' ? '!' : '—'}
              </span>
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
