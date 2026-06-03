import { cn } from '@/lib/utils';

type ProgressMeterProps = {
  value?: number | null;
  className?: string;
  size?: 'sm' | 'md';
};

export function ProgressMeter({ value, className, size = 'md' }: ProgressMeterProps) {
  const numericValue = Number(value);
  const percent = Math.round(Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 0);

  return (
    <div className={cn('flex min-w-[132px] items-center gap-2', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-grayCard',
          size === 'sm' ? 'h-2' : 'h-2.5',
        )}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold text-bodyText">{percent}%</span>
    </div>
  );
}
