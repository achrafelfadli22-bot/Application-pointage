export type TimesheetTaskType = {
  value: string;
  label: string;
  isActive: boolean;
};

export const DEFAULT_TIMESHEET_TASK_TYPES: TimesheetTaskType[] = [];

export function normalizeTaskTypeValue(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
