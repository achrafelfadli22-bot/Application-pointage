'use client';

import { useState } from 'react';
import { addDays, addMonths, format, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export type TimeOffCalendarEvent = {
  date: string;
  label: string;
  status: string;
};

function statusStyle(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'border-successBorder bg-successBg text-successText';
    case 'SUBMITTED':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'REJECTED':
      return 'border-dangerBorder bg-dangerBg text-dangerText';
    case 'CANCELLED':
      return 'border-borderSoft bg-grayCard text-mutedText';
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'Approuve';
    case 'SUBMITTED':
      return 'En attente';
    case 'REJECTED':
      return 'Refuse';
    case 'CANCELLED':
      return 'Annule';
    default:
      return 'Brouillon';
  }
}

export function TimeOffCalendar({
  events = [],
  ownerName,
}: {
  events?: TimeOffCalendarEvent[];
  ownerName?: string;
}) {
  const [month, setMonth] = useState(new Date());
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const monthLabel = format(month, 'MMMM yyyy', { locale: fr });
  const eventsByDate = events.reduce<Record<string, TimeOffCalendarEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] ?? []), event];
    return acc;
  }, {});

  return (
    <div className="overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-borderSoft px-5 py-3">
        <div>
          <p className="text-sm font-semibold capitalize text-bodyText">{monthLabel}</p>
          {ownerName && <p className="mt-0.5 text-xs text-mutedText">{ownerName}</p>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover hover:text-bodyText"
            aria-label="Mois precedent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth(new Date())}
            className="rounded-md px-2 text-xs text-mutedText hover:bg-surfaceHover hover:text-bodyText"
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover hover:text-bodyText"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-borderSoft bg-grayCard">
        {JOURS.map((j) => (
          <div key={j} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-mutedText">
            {j}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = day.getMonth() === month.getMonth();
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
          const dayEvents = eventsByDate[dateStr] ?? [];

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-20 border-b border-r border-borderSoft p-2',
                !isCurrentMonth && 'opacity-30',
                isWeekend && 'bg-grayCard',
                isToday && 'bg-accentLight',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isToday ? 'bg-accent text-white' : 'text-bodyText',
                )}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 grid gap-1">
                {dayEvents.slice(0, 2).map((event, index) => (
                  <div
                    key={`${event.date}-${event.label}-${event.status}-${index}`}
                    className={cn(
                      'truncate rounded border px-1.5 py-0.5 text-xs font-medium',
                      statusStyle(event.status),
                    )}
                    title={`${event.label} - ${statusLabel(event.status)}`}
                  >
                    {event.label || 'Conge'}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="rounded border border-borderSoft bg-grayCard px-1.5 py-0.5 text-xs font-medium text-mutedText">
                    +{dayEvents.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
