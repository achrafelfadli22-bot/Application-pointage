import {
  BarChart3,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Clock4,
  CreditCard,
  FolderKanban,
  HardHat,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldAlert,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: readonly string[];
  exact?: boolean;
  section?: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  // ── Opérationnel ────────────────────────────────────────────────────────────
  { label: 'Tableau de bord',   href: '/dashboard',            icon: LayoutDashboard, roles: ['EMPLOYEE', 'MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },
  { label: 'Pointage',          href: '/attendance',            icon: Clock4,          roles: ['EMPLOYEE', 'MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },
  { label: 'Feuilles de temps', href: '/timesheets',            icon: ClipboardList,   roles: ['EMPLOYEE', 'MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },
  { label: 'Congés',            href: '/time-off',              icon: CalendarClock,   roles: ['EMPLOYEE', 'MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'], exact: true },
  { label: 'Demandes de congé', href: '/time-off/requests',     icon: ClipboardList,   roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },

  // ── RH & Opérations ─────────────────────────────────────────────────────────
  { label: 'Mon équipe',        href: '/team',                  icon: Users,           roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'],  section: 'RH & Opérations' },
  { label: 'Planning équipe',   href: '/planning',              icon: CalendarRange,   roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },
  { label: 'Projets',           href: '/projects',              icon: FolderKanban,    roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },
  { label: 'Chantiers',         href: '/sites',                 icon: HardHat,         roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },
  { label: 'Rapports',          href: '/reports',               icon: BarChart3,       roles: ['EMPLOYEE', 'MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'] },

  // ── Compte ──────────────────────────────────────────────────────────────────
  { label: 'Mon profil',         href: '/profile',               icon: UserCircle,      roles: ['EMPLOYEE', 'MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER', 'SUPER_ADMIN'], section: 'Compte' },

  // ── Administration société ───────────────────────────────────────────────────
  { label: 'Paramètres',        href: '/settings',              icon: Settings,        roles: ['RESOURCE_MANAGER', 'HR'] },
  { label: "Journal d'audit",   href: '/audit-log',             icon: Shield,          roles: ['RESOURCE_MANAGER', 'HR', 'SUPER_ADMIN'] },

  // ── Super Admin plateforme ───────────────────────────────────────────────────
  { label: 'Admin — Sociétés',     href: '/admin/tenants',       icon: ShieldAlert, roles: ['SUPER_ADMIN'], section: 'Administration' },
  { label: 'Admin — Abonnements',  href: '/admin/subscriptions', icon: CreditCard,  roles: ['SUPER_ADMIN'] },
] as const;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:  'Super Administrateur',
  RESOURCE_MANAGER: 'Ressource Manager',
  HR:           'RH',
  PROJECT_MANAGER: 'Chef de projet',
  MANAGER:      'Chef de site',
  EMPLOYEE:     'Employé',
};
