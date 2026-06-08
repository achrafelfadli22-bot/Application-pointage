import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  APPROVED:   { label: 'Approuvé',    className: 'bg-successBg text-successText border-successBorder' },
  Approved:   { label: 'Approuvé',    className: 'bg-successBg text-successText border-successBorder' },
  SUBMITTED:  { label: 'En attente',  className: 'bg-infoBg text-infoText border-infoBorder' },
  Submitted:  { label: 'En attente',  className: 'bg-infoBg text-infoText border-infoBorder' },
  N1_APPROVED: { label: 'ValidÃ© N+1', className: 'bg-warningBg text-warningText border-warningBorder' },
  DRAFT:      { label: 'Brouillon',   className: 'bg-grayCard text-mutedText border-borderSoft' },
  Draft:      { label: 'Brouillon',   className: 'bg-grayCard text-mutedText border-borderSoft' },
  REJECTED:   { label: 'Refusé',      className: 'bg-dangerBg text-dangerText border-dangerBorder' },
  Rejected:   { label: 'Refusé',      className: 'bg-dangerBg text-dangerText border-dangerBorder' },
  REOPENED:   { label: 'Rouvert',     className: 'bg-warningBg text-warningText border-warningBorder' },
  Reopened:   { label: 'Rouvert',     className: 'bg-warningBg text-warningText border-warningBorder' },
  CANCELLED:  { label: 'Annulé',      className: 'bg-grayCard text-mutedText border-borderSoft' },
  Cancelled:  { label: 'Annulé',      className: 'bg-grayCard text-mutedText border-borderSoft' },
  ACTIVE:     { label: 'Actif',       className: 'bg-successBg text-successText border-successBorder' },
  SUSPENDED:  { label: 'Suspendu',    className: 'bg-dangerBg text-dangerText border-dangerBorder' },
  TRIAL:      { label: 'Essai',       className: 'bg-warningBg text-warningText border-warningBorder' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const config = statusConfig[status];
  const label = config?.label ?? status.replaceAll('_', ' ');
  const styles = config?.className ?? 'bg-grayCard text-mutedText border-borderSoft';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        styles,
        className,
      )}
    >
      {label}
    </span>
  );
}
