'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight, Menu, X } from 'lucide-react';
import { api, tokenStore } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/nav-items';

const breadcrumbs: Record<string, string[]> = {
  '/dashboard':            ['Tableau de bord'],
  '/timesheets':           ['Feuilles de temps'],
  '/team':                 ['Mon équipe'],
  '/projects':             ['Projets'],
  '/sites':                ['Sites'],
  '/attendance':           ['Pointage'],
  '/time-off':             ['Congés'],
  '/time-off/requests':    ['Congés', 'Demandes'],
  '/reports':              ['Rapports'],
  '/settings':             ['Paramètres'],
  '/planning':             ['Planning équipe'],
  '/admin/tenants':        ['Administration', 'Sociétés'],
  '/admin/subscriptions':  ['Administration', 'Abonnements'],
  '/audit-log':            ["Journal d'audit"],
  '/profile':              ['Mon profil'],
  '/forgot-password':      ['Mot de passe oublié'],
  '/reset-password':       ['Réinitialisation'],
};

type PersonCrumb = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
};

type TimesheetCrumb = {
  periodStart?: string | null;
  periodEnd?: string | null;
  user?: PersonCrumb | null;
};

type EmployeeCrumb = {
  employeeNumber?: string | null;
  user?: PersonCrumb | null;
};

type SiteCrumb = {
  code?: string | null;
  name?: string | null;
};

type ProjectCrumb = {
  code?: string | null;
  name?: string | null;
  clientName?: string | null;
};

function personName(person?: PersonCrumb | null) {
  const fullName = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
  return fullName || person?.fullName || '';
}

function shortDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function dateRange(start?: string | null, end?: string | null) {
  const from = shortDate(start);
  const to = shortDate(end);
  return from && to ? `${from} - ${to}` : '';
}

function timesheetBreadcrumb(timesheet: TimesheetCrumb) {
  const employee = personName(timesheet.user) || 'Employe';
  const period = dateRange(timesheet.periodStart, timesheet.periodEnd);
  return period ? `Feuille de temps ${employee} - ${period}` : `Feuille de temps ${employee}`;
}

function employeeBreadcrumb(employee: EmployeeCrumb) {
  const name = personName(employee.user) || 'Fiche employe';
  return employee.employeeNumber ? `${name} - ${employee.employeeNumber}` : name;
}

function siteBreadcrumb(site: SiteCrumb) {
  if (site.code && site.name) return `${site.code} - ${site.name}`;
  return site.name || site.code || 'Detail site';
}

function projectBreadcrumb(project: ProjectCrumb) {
  const label = project.code && project.name ? `${project.code} - ${project.name}` : project.name || project.code;
  return project.clientName && label ? `${label} - ${project.clientName}` : label || 'Detail projet';
}

function getBreadcrumbs(pathname: string, detailLabel?: string | null): string[] {
  if (breadcrumbs[pathname]) return breadcrumbs[pathname]!;

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'timesheets') {
    return ['Feuilles de temps', detailLabel || 'Detail feuille de temps'];
  }
  if (parts.length === 2 && parts[0] === 'team') {
    return ['Mon equipe', detailLabel || 'Fiche employe'];
  }
  if (parts.length === 2 && parts[0] === 'sites') {
    return ['Sites', detailLabel || 'Detail site'];
  }
  if (parts.length === 2 && parts[0] === 'projects') {
    return ['Projets', detailLabel || 'Detail projet'];
  }

  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

type Notif = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string;
};

export function TopBar({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const pathname = usePathname() ?? '';
  const [detailCrumb, setDetailCrumb] = useState<string | null>(null);
  const crumbs = getBreadcrumbs(pathname, detailCrumb);
  const session = tokenStore.session;
  const initials = session
    ? `${session.user.firstName?.[0] ?? ''}${session.user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';
  const fullName = session?.user.fullName ?? session?.user.email ?? 'Utilisateur';

  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [open, setOpen]         = useState(false);
  const [pulsing, setPulsing]   = useState(false);
  const panelRef                = useRef<HTMLDivElement>(null);
  const prevUnreadRef           = useRef(0);

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await api.notifications() as Notif[];
      setNotifs(data);
      const newUnread = data.filter((n) => !n.isRead).length;
      if (newUnread > prevUnreadRef.current) {
        setPulsing(true);
        setTimeout(() => setPulsing(false), 2000);
      }
      prevUnreadRef.current = newUnread;
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const parts = pathname.split('/').filter(Boolean);
    setDetailCrumb(null);

    if (parts.length !== 2) {
      return () => {
        cancelled = true;
      };
    }

    const [rawSection, rawId] = parts;
    const section =
      rawSection === 'timesheets' || rawSection === 'team' || rawSection === 'sites' || rawSection === 'projects'
        ? rawSection
        : null;
    if (!rawId || !section) {
      return () => {
        cancelled = true;
      };
    }
    const id = rawId;

    async function loadDetailCrumb() {
      try {
        let label = '';
        if (section === 'timesheets') {
          label = timesheetBreadcrumb((await api.timesheet(id)) as TimesheetCrumb);
        } else if (section === 'team') {
          label = employeeBreadcrumb((await api.employee(id)) as EmployeeCrumb);
        } else if (section === 'sites') {
          label = siteBreadcrumb((await api.site(id)) as SiteCrumb);
        } else if (section === 'projects') {
          label = projectBreadcrumb((await api.project(id)) as ProjectCrumb);
        }

        if (!cancelled) {
          setDetailCrumb(label || null);
        }
      } catch {
        if (!cancelled) {
          setDetailCrumb(null);
        }
      }
    }

    void loadDetailCrumb();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function markRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Fallback: mark all locally even if API fails
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  }

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  return (
    <header className="flex h-16 items-center justify-between border-b border-borderSoft bg-surface px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Hamburger — visible uniquement sur mobile */}
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex h-8 w-8 items-center justify-center rounded-md text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText lg:hidden"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Fil d'ariane */}
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={`${crumb}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-hintText" />}
            <span className={`truncate ${i === crumbs.length - 1 ? 'max-w-[55vw] font-medium text-bodyText' : 'text-mutedText'}`}>
              {crumb}
            </span>
          </span>
        ))}
        </nav>
      </div>

      {/* Actions droite */}
      <div className="flex items-center gap-3">
        {/* Cloche notifications */}
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText"
            aria-label="Notifications"
          >
            <Bell className={`h-4 w-4 transition-colors ${unreadCount > 0 ? 'text-accent' : ''}`} />
            {unreadCount > 0 && (
              <span className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white ${pulsing ? 'animate-ping' : ''}`}>
                {pulsing ? '' : (unreadCount > 9 ? '9+' : unreadCount)}
              </span>
            )}
            {unreadCount > 0 && pulsing && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown notifications */}
          {open && (
            <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-borderSoft bg-surface shadow-dropdown">
              <div className="flex items-center justify-between border-b border-borderSoft px-4 py-3">
                <p className="text-sm font-semibold text-bodyText">
                  Notifications {unreadCount > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
                </p>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                      title="Tout marquer comme lu"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Tout lire
                    </button>
                  )}
                  <button type="button" onClick={() => setOpen(false)} className="text-mutedText hover:text-bodyText">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-mutedText">Aucune notification</p>
                ) : (
                  notifs.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id)}
                      className={`block w-full border-b border-borderSoft px-4 py-3 text-left transition-colors last:border-0 hover:bg-surfaceHover ${n.isRead ? '' : 'bg-accentLight/30'}`}
                    >
                      <p className="text-xs font-semibold text-bodyText">{n.title}</p>
                      <p className="mt-0.5 text-xs text-mutedText line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[10px] text-hintText">
                        {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar utilisateur */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accentLight text-xs font-semibold text-accentText">
            {initials}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-bodyText">{fullName}</div>
            <div className="text-[10px] text-mutedText">{session?.user.role ? ROLE_LABELS[session.user.role] ?? session.user.role : ''}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
