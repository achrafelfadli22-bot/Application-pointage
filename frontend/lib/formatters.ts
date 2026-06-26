/**
 * Shared date / time / numeric formatters — French locale.
 * Import from here instead of re-defining per-page.
 */

// ── Date ──────────────────────────────────────────────────────────────────────

/** "lun. 09 juin" */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** "09/06/2026" */
export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** "juin 2026" */
export function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** "lun. 09 juin 2026" */
export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Time ─────────────────────────────────────────────────────────────────────

/** "08:30" */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "08:30:00" */
export function fmtTimeFull(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ── Duration ─────────────────────────────────────────────────────────────────

/** 90 min → "1h30" · 60 min → "1h" · null → "—" */
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes === 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** 7.5 (hours) → "7h30" */
export function fmtDurationHours(hours: number): string {
  return fmtDuration(Math.round(hours * 60));
}

// ── Numbers ──────────────────────────────────────────────────────────────────

/** 1234.5 → "1 234,50 MAD" */
export function fmtCurrency(amount: number, currency = 'MAD'): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** 0.75 → "75 %" */
export function fmtPercent(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)} %`;
}
