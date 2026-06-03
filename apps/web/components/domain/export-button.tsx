import { Download } from 'lucide-react';
import { SecondaryButton } from '../ui/buttons';

export function ExportButton({ onClick }: { onClick?: () => void }) {
  return (
    <SecondaryButton type="button" onClick={onClick}>
      <Download className="h-4 w-4" />
      Exporter CSV
    </SecondaryButton>
  );
}
