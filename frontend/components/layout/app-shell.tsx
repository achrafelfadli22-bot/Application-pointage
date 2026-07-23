'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { MobileDrawer } from './mobile-drawer';
import { tokenStore } from '@/lib/api-client';
import { PageSkeleton } from '@/components/ui/skeleton';
import { NAV_ITEMS } from '@/lib/nav-items';

export function AppShell({
  children,
  loading = false,
  skeletonProps,
}: {
  children: React.ReactNode;
  /** When true, replaces page content with an animated skeleton */
  loading?: boolean;
  skeletonProps?: React.ComponentProps<typeof PageSkeleton>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!tokenStore.accessToken && pathname !== '/login') {
      router.replace('/login');
      return;
    }
    const role = tokenStore.session?.role;
    const protectedItem = NAV_ITEMS
      .filter((item) => pathname === item.href || pathname?.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (role && protectedItem && !(protectedItem.roles as readonly string[]).includes(role)) {
      setReady(false);
      router.replace(role === 'SUPER_ADMIN' ? '/admin/tenants' : '/dashboard');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  // Fermer le drawer à chaque changement de route
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-pageBg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-pageBg">
      {/* Sidebar desktop */}
      <Sidebar />

      {/* Drawer mobile */}
      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:ml-[240px]">
        <TopBar onMenuOpen={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-6 lg:p-8">
          {loading ? <PageSkeleton {...skeletonProps} /> : children}
        </main>
      </div>
    </div>
  );
}
