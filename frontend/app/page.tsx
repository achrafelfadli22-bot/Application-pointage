'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';
import { tokenStore } from '@/lib/api-client';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect authenticated users directly to their dashboard
    if (tokenStore.session) {
      router.replace(
        tokenStore.session.role === 'SUPER_ADMIN' ? '/admin/tenants' : '/dashboard',
      );
    }
  }, [router]);

  return <LandingPage />;
}
