import { CheckCircle2, XCircle } from 'lucide-react';
import { PrimaryButton, DangerButton } from '../ui/buttons';

export function ApprovalPanel({
  title = 'Actions manager',
  onApprove,
  onReject,
}: {
  title?: string;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <div className="rounded-xl border border-borderSoft bg-surface p-4 shadow-card">
      <p className="text-sm font-semibold text-bodyText">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={onApprove}>
          <CheckCircle2 className="h-4 w-4" />
          Approuver
        </PrimaryButton>
        <DangerButton type="button" onClick={onReject}>
          <XCircle className="h-4 w-4" />
          Refuser
        </DangerButton>
      </div>
    </div>
  );
}
