import { cn } from '@/lib/utils';

export function Pointage360Logo({
  compact = false,
  className,
  tone = 'light',
}: {
  compact?: boolean;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const textColor = tone === 'light' ? 'text-white' : 'text-navy';
  const subColor = tone === 'light' ? 'text-white/60' : 'text-mutedText';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        aria-hidden="true"
        className="h-11 w-11 shrink-0"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="48" rx="6" fill={tone === 'light' ? 'rgba(255,255,255,0.12)' : '#1B3A5C'} />
        <path d="M14 35V18.5l10-5.5 10 5.5V35" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M20 35v-8h8v8" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
        <path
          d="M24 8.5c8.56 0 15.5 6.94 15.5 15.5 0 4.35-1.79 8.28-4.67 11.1"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path
          d="M8.5 24c0-5.86 3.25-10.96 8.04-13.6"
          stroke="#6AADD5"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path d="M24 17v7l5 3" stroke="#6AADD5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="2.9" fill="#FFFFFF" />
        <path
          d="M14.5 34.5h19"
          stroke={tone === 'light' ? 'rgba(255,255,255,0.55)' : '#D0DCE8'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {!compact ? (
        <div className="leading-none">
          <div className={cn('text-xl font-semibold tracking-normal', textColor)}>Pointage360</div>
          <div className={cn('mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]', subColor)}>
            Temps et sites
          </div>
        </div>
      ) : null}
    </div>
  );
}
