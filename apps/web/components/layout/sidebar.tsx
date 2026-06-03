'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Clock4, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokenStore } from '@/lib/api-client';
import { NAV_ITEMS, ROLE_LABELS } from '@/lib/nav-items';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = tokenStore.session?.role ?? '';

  function handleLogout() {
    tokenStore.clear();
    router.push('/login');
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(role),
  );

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-borderSoft bg-surface lg:flex lg:min-h-screen">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-borderSoft px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A]">
          <Clock4 className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-bodyText">Pointage360</div>
          <div className="text-[10px] font-medium text-mutedText">Gestion RH & Chantiers</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const sectionLabel = 'section' in item ? item.section : undefined;
          return (
            <div key={item.href}>
              {sectionLabel && (
                <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-widest text-hintText">
                  {sectionLabel}
                </div>
              )}
              <Link
                href={item.href}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accentLight text-accentText'
                    : 'text-mutedText hover:bg-surfaceHover hover:text-bodyText',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-hintText')} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Utilisateur connecté */}
      {role && (
        <div className="border-t border-borderSoft px-3 py-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accentLight text-xs font-bold text-accentText">
              {tokenStore.session?.user?.firstName?.[0] ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-bodyText">
                {tokenStore.session?.user?.fullName ?? '—'}
              </div>
              <div className="text-[10px] text-mutedText">{ROLE_LABELS[role] ?? role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Déconnexion */}
      <div className="border-t border-borderSoft p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-mutedText transition-colors hover:bg-dangerBg hover:text-dangerText"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
