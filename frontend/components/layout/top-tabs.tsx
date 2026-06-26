'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Feuilles de temps', href: '/timesheets' },
  { label: 'Congés', href: '/time-off' },
  { label: 'Pointage', href: '/attendance' },
  { label: 'Rapports', href: '/reports' },
];

export function TopTabs() {
  const pathname = usePathname() ?? '';

  return (
    <div className="overflow-x-auto border-b border-borderSoft bg-white">
      <div className="flex min-w-max gap-6 px-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                'flex h-12 items-center border-b-[3px] border-transparent text-sm font-semibold text-mutedText',
                active && 'border-accent text-navy',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
