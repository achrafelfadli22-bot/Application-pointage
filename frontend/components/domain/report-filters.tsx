import { Search } from 'lucide-react';
import { PrimaryButton } from '../ui/buttons';
import { DateField, SelectField } from '../ui/form-fields';

export function ReportFilters() {
  return (
    <div className="grid gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card md:grid-cols-5">
      <DateField label="Date début" />
      <DateField label="Date fin" />
      <SelectField label="Chantier">
        <option value="">Tous</option>
        <option>CH-001</option>
      </SelectField>
      <SelectField label="Employé">
        <option value="">Tous</option>
      </SelectField>
      <div className="flex items-end">
        <PrimaryButton type="button" className="w-full">
          <Search className="h-4 w-4" />
          Filtrer
        </PrimaryButton>
      </div>
    </div>
  );
}
