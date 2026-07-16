export type TimesheetTaskType = {
  value: string;
  label: string;
  isActive: boolean;
};

export const DEFAULT_TIMESHEET_TASK_TYPES: TimesheetTaskType[] = [
  { value: 'EXECUTION', label: 'Execution travaux', isActive: true },
  { value: 'PREPARATION', label: 'Preparation', isActive: true },
  { value: 'REUNION_SITE', label: 'Reunion site', isActive: true },
  { value: 'CONTROLE_QUALITE', label: 'Controle qualite', isActive: true },
  { value: 'ADMINISTRATIF', label: 'Administratif', isActive: true },
  { value: 'AUTRE', label: 'Autre', isActive: true },
];

export function normalizeTaskTypeValue(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
