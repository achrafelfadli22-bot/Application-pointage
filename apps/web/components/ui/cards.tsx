import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-borderSoft bg-surface shadow-card', className)}>
      {children}
    </div>
  );
}

export function AccentCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border-l-4 border-l-accent border-y border-r border-borderSoft bg-surface shadow-card p-5', className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  caption,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  caption?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.FC<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-borderSoft bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-mutedText">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentLight">
            <Icon className="h-4 w-4 text-accent" />
          </div>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold text-bodyText">{value}</p>
      {(caption || trend) && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-mutedText">
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-successText" />}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-dangerText" />}
          {trend === 'neutral' && <Minus className="h-3.5 w-3.5" />}
          {caption && <span>{caption}</span>}
        </div>
      )}
    </div>
  );
}

export function SummaryCounters({
  items,
}: {
  items: Array<{ label: string; value: string | number; active?: boolean; onClick?: () => void }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => {
        const className = cn(
          'rounded-lg border px-4 py-2 text-sm transition',
          item.active
            ? 'border-accent bg-accentLight font-medium text-accentText'
            : 'border-borderSoft bg-surface text-mutedText',
          item.onClick && 'cursor-pointer hover:border-accent hover:bg-accentLight hover:text-accentText',
        );
        const content = (
          <>
            <span className="font-semibold">{item.value}</span>
            <span className="ml-1.5">{item.label}</span>
          </>
        );

        return item.onClick ? (
          <button key={`${item.label}-${i}`} type="button" className={className} onClick={item.onClick}>
            {content}
          </button>
        ) : (
          <div key={`${item.label}-${i}`} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
