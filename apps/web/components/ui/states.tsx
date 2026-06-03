import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-borderSoft bg-surface py-14 text-center">
      <Inbox className="mb-3 h-8 w-8 text-hintText" />
      <p className="text-sm font-medium text-bodyText">{title}</p>
      {description && <p className="mt-1 text-sm text-mutedText">{description}</p>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-borderSoft bg-surface">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-accent" />
      <span className="text-sm text-mutedText">Chargement…</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

export function AlertBanner({ message, type = 'danger' }: { message: string; type?: 'danger' | 'success' | 'warning' | 'info' }) {
  const styles = {
    danger:  'border-dangerBorder bg-dangerBg text-dangerText',
    success: 'border-successBorder bg-successBg text-successText',
    warning: 'border-warningBorder bg-warningBg text-warningText',
    info:    'border-infoBorder bg-infoBg text-infoText',
  };
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
