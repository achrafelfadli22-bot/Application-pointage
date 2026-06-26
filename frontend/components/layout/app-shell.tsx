'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { MobileDrawer } from './mobile-drawer';
import { tokenStore } from '@/lib/api-client';
import { PageSkeleton } from '@/components/ui/skeleton';

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
    setReady(true);
  }, [pathname, router]);

  // Fermer le drawer à chaque changement de route
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pageBg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-pageBg">
      {/* Sidebar desktop */}
      <Sidebar />

      {/* Drawer mobile */}
      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuOpen={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-6 lg:p-8">
          {loading ? <PageSkeleton {...skeletonProps} /> : children}
        </main>
      </div>
    </div>
  );
}
