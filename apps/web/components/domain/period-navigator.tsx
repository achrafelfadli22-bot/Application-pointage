'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SecondaryButton } from '../ui/buttons';

export function PeriodNavigator({ label = '18 mai 2026 – 24 mai 2026' }: { label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SecondaryButton type="button" aria-label="Période précédente">
        <ChevronLeft className="h-4 w-4" />
      </SecondaryButton>
      <div className="h-9 min-w-60 rounded-md border border-borderSoft bg-surface px-4 py-2 text-center text-sm font-medium text-bodyText">
        {label}
      </div>
      <SecondaryButton type="button" aria-label="Période suivante">
        <ChevronRight className="h-4 w-4" />
      </SecondaryButton>
      {['Période actuelle', 'Période précédente', 'Ce mois', 'Ce trimestre'].map((item) => (
        <SecondaryButton key={item} type="button">
          {item}
        </SecondaryButton>
      ))}
    </div>
  );
}
