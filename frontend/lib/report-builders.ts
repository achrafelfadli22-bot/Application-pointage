/**
 * Transforms raw API JSON into ExcelSheet definitions for each report type.
 * Each builder returns an array of sheets (some reports have 2 sheets).
 */

import type { ExcelSheet, CellValue } from './excel-export';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR');
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(minutes: number | null | undefined): number {
  return Number(((minutes ?? 0) / 60).toFixed(2));
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon', SUBMITTED: 'Soumis', APPROVED: 'Approuvé',
    REJECTED: 'Refusé', REOPENED: 'Rouvert', CANCELLED: 'Annulé',
    ACTIVE: 'Actif', INACTIVE: 'Inactif',
  };
  return s === 'N1_APPROVED' ? 'Pre-approuvee' : map[s] ?? s;
}

function isoDay(value: string | Date | null | undefined): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function dateKeysBetween(start?: string | null, end?: string | null): string[] {
  if (!start || !end) return [];
  const first = new Date(isoDay(start));
  const last = new Date(isoDay(end));
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || last < first) return [];

  const keys: string[] = [];
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
  const limit = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));

  while (cursor <= limit && keys.length < 62) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

function dateHeader(key: string): string {
  const date = new Date(key);
  return Number.isNaN(date.getTime())
    ? key
    : date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function safeSheetName(value: string, fallback: string) {
  const cleaned = (value || fallback).replace(/[\\/?*:[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, 31);
}

function fullName(user: any) {
  return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'Employe';
}

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function metricValue(row: any, key: string, fallback = 0) {
  return numberValue(row?.metrics?.[key] ?? fallback);
}

function joinLabel(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' - ') || '-';
}

// ─── Présence journalière ─────────────────────────────────────────────────────

export function buildAttendanceSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((p) => ({
    employe:  `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim(),
    email:    p.user?.email ?? '',
    site: p.site?.name ?? '—',
    code:     p.site?.code ?? '',
    date:     fmtDate(p.punchDate),
    entree:   fmtTime(p.checkInAt),
    sortie:   fmtTime(p.checkOutAt),
    duree:    fmtHours(p.durationMinutes),
    statut:   statusLabel(p.status ?? ''),
  }));

  return [{
    name: 'Présence',
    columns: [
      { header: 'Employé',         key: 'employe',    width: 22 },
      { header: 'Email',            key: 'email',      width: 28 },
      { header: 'Site',         key: 'site',   width: 24 },
      { header: 'Code site',    key: 'code',       width: 14 },
      { header: 'Date',             key: 'date',       width: 14 },
      { header: 'Entrée',           key: 'entree',     width: 10 },
      { header: 'Sortie',           key: 'sortie',     width: 10 },
      { header: 'Durée (h)',        key: 'duree',      width: 12, type: 'number' },
      { header: 'Statut',           key: 'statut',     width: 14 },
    ],
    rows,
    totals: {
      employe: `${rows.length} pointage(s)`,
      duree: rows.reduce((s, r) => s + (r.duree as number), 0),
    },
  }];
}


// ─── Heures par site ──────────────────────────────────────────────────────

export function buildHoursBySiteSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((r) => ({
    code:      r.site?.code ?? '—',
    site:  r.site?.name ?? '—',
    ville:     r.site?.city ?? '',
    heures:    r.hours ?? 0,
    pointages: r.punches ?? 0,
  }));

  const totalH = rows.reduce((s, r) => s + (r.heures as number), 0);
  const totalP = rows.reduce((s, r) => s + (r.pointages as number), 0);

  return [{
    name: 'Heures par site',
    columns: [
      { header: 'Code site', key: 'code',      width: 16 },
      { header: 'Site',      key: 'site',  width: 28 },
      { header: 'Ville',         key: 'ville',     width: 18 },
      { header: 'Total heures',  key: 'heures',    width: 14, type: 'number' },
      { header: 'Nb pointages',  key: 'pointages', width: 14, type: 'number' },
    ],
    rows,
    totals: {
      code:      'TOTAL',
      heures:    Number(totalH.toFixed(2)),
      pointages: totalP,
    },
  }];
}

// ─── Heures par employé ───────────────────────────────────────────────────────

export function buildHoursByEmployeeSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((r) => ({
    employe:   `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
    email:     r.user?.email ?? '',
    heures:    r.hours ?? 0,
    minutes:   r.durationMinutes ?? 0,
    pointages: r.punches ?? 0,
  }));

  const totalH = rows.reduce((s, r) => s + (r.heures as number), 0);
  const totalP = rows.reduce((s, r) => s + (r.pointages as number), 0);

  return [{
    name: 'Heures par employé',
    columns: [
      { header: 'Employé',        key: 'employe',   width: 24 },
      { header: 'Email',          key: 'email',     width: 28 },
      { header: 'Total heures',   key: 'heures',    width: 14, type: 'number' },
      { header: 'Total minutes',  key: 'minutes',   width: 14, type: 'number' },
      { header: 'Nb pointages',   key: 'pointages', width: 14, type: 'number' },
    ],
    rows,
    totals: {
      employe:   'TOTAL',
      heures:    Number(totalH.toFixed(2)),
      pointages: totalP,
    },
  }];
}

// ─── Feuilles de temps ────────────────────────────────────────────────────────

export function buildTimesheetsSheet(data: any[]): ExcelSheet[] {
  const dateKeys = Array.from(
    data.reduce((set: Set<string>, ts) => {
      dateKeysBetween(ts.periodStart, ts.periodEnd).forEach((key) => set.add(key));
      for (const line of ts.lines ?? []) {
        for (const entry of line.entries ?? []) {
          const key = isoDay(entry.entryDate);
          if (key) set.add(key);
        }
      }
      return set;
    }, new Set<string>()),
  ).sort();

  const effectiveDateKeys = dateKeys.length ? dateKeys : [new Date().toISOString().slice(0, 10)];
  const dateColumns = effectiveDateKeys.map((key, index) => ({
    header: dateHeader(key),
    key: `d${index}`,
    width: 10,
    type: 'number' as const,
  }));

  const summaryByUser = new Map<string, Record<string, CellValue>>();
  const sheetsByUser = new Map<string, { user: any; timesheets: any[] }>();

  for (const ts of data) {
    const userKey = ts.user?.id || ts.user?.email || fullName(ts.user);
    if (!sheetsByUser.has(userKey)) {
      sheetsByUser.set(userKey, { user: ts.user, timesheets: [] });
    }
    sheetsByUser.get(userKey)!.timesheets.push(ts);

    const totalHours = (ts.lines ?? []).reduce(
      (sum: number, line: any) =>
        sum + (line.entries ?? []).reduce((entrySum: number, entry: any) => entrySum + numberValue(entry.hours), 0),
      0,
    );

    const normalHours = metricValue(ts, 'normalHours', totalHours);
    const overtimeHours = metricValue(ts, 'overtimeHours', 0);
    const billableHours = metricValue(ts, 'billableHours', totalHours);
    const nonBillableHours = metricValue(ts, 'nonBillableHours', 0);
    const leaveDays = metricValue(ts, 'leaveDays', 0);
    const publicHolidays = metricValue(ts, 'publicHolidays', 0);
    const previous = summaryByUser.get(userKey);
    summaryByUser.set(userKey, {
      employe: fullName(ts.user),
      matricule: ts.user?.employeeProfile?.employeeNumber ?? '',
      email: ts.user?.email ?? '',
      debut: previous?.debut || fmtDate(ts.periodStart),
      fin: fmtDate(ts.periodEnd) || previous?.fin || '',
      statuts: previous?.statuts ? `${previous.statuts}, ${statusLabel(ts.status ?? '')}` : statusLabel(ts.status ?? ''),
      timesheets: numberValue(previous?.timesheets) + 1,
      heures: Number((numberValue(previous?.heures) + totalHours).toFixed(2)),
      normalHours: Number((numberValue(previous?.normalHours) + normalHours).toFixed(2)),
      overtimeHours: Number((numberValue(previous?.overtimeHours) + overtimeHours).toFixed(2)),
      billableHours: Number((numberValue(previous?.billableHours) + billableHours).toFixed(2)),
      nonBillableHours: Number((numberValue(previous?.nonBillableHours) + nonBillableHours).toFixed(2)),
      leaveDays: Number((numberValue(previous?.leaveDays) + leaveDays).toFixed(2)),
      publicHolidays: Number((numberValue(previous?.publicHolidays) + publicHolidays).toFixed(2)),
    });
  }

  const summaryRows = Array.from(summaryByUser.values()).sort((a, b) =>
    String(a.employe).localeCompare(String(b.employe), 'fr-FR'),
  );

  const sheets: ExcelSheet[] = [
    {
      name: 'Synthese consolidee',
      columns: [
        { header: 'Employe', key: 'employe', width: 26 },
        { header: 'Matricule', key: 'matricule', width: 14 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Debut', key: 'debut', width: 14 },
        { header: 'Fin', key: 'fin', width: 14 },
        { header: 'Statuts', key: 'statuts', width: 24 },
        { header: 'Nb feuilles', key: 'timesheets', width: 14, type: 'number' },
        { header: 'Total', key: 'heures', width: 12, type: 'number', style: 'total' },
        { header: 'Heures normales', key: 'normalHours', width: 16, type: 'number' },
        { header: 'Heures sup.', key: 'overtimeHours', width: 14, type: 'number' },
        { header: 'Facturable', key: 'billableHours', width: 14, type: 'number' },
        { header: 'Non facturable', key: 'nonBillableHours', width: 16, type: 'number' },
        { header: 'Conges approuves (j)', key: 'leaveDays', width: 20, type: 'number' },
        { header: 'Jours feries', key: 'publicHolidays', width: 14, type: 'number' },
      ],
      rows: summaryRows,
      totals: {
        employe: 'TOTAL',
        timesheets: summaryRows.reduce((sum, row) => sum + numberValue(row.timesheets), 0),
        heures: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.heures), 0).toFixed(2)),
        normalHours: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.normalHours), 0).toFixed(2)),
        overtimeHours: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.overtimeHours), 0).toFixed(2)),
        billableHours: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.billableHours), 0).toFixed(2)),
        nonBillableHours: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.nonBillableHours), 0).toFixed(2)),
        leaveDays: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.leaveDays), 0).toFixed(2)),
        publicHolidays: Number(summaryRows.reduce((sum, row) => sum + numberValue(row.publicHolidays), 0).toFixed(2)),
      },
    },
  ];

  const usedSheetNames = new Set<string>(sheets.map((sheet) => sheet.name));

  for (const [index, group] of Array.from(sheetsByUser.values()).entries()) {
    const user = group.user;
    const rowsByLine = new Map<string, Record<string, CellValue>>();
    const totalsByDate: Record<string, number> = Object.fromEntries(effectiveDateKeys.map((_, i) => [`d${i}`, 0]));

    for (const ts of group.timesheets) {
      for (const line of ts.lines ?? []) {
        const project = line.site?.project ? joinLabel(line.site.project.code, line.site.project.name) : '-';
        const site = line.site ? joinLabel(line.site.code, line.site.name) : line.placeOfWork || '-';
        const rubrique = line.activity || line.taskName || 'Tache';
        const key = [rubrique, project, site, line.taskName].join('|');

        if (!rowsByLine.has(key)) {
          rowsByLine.set(key, {
            rubrique,
            projet: project,
            site: site,
            description: line.taskName || '',
            ...Object.fromEntries(effectiveDateKeys.map((_, i) => [`d${i}`, 0])),
            total: 0,
          });
        }

        const row = rowsByLine.get(key)!;
        for (const entry of line.entries ?? []) {
          const dateIndex = effectiveDateKeys.indexOf(isoDay(entry.entryDate));
          if (dateIndex < 0) continue;
          const colKey = `d${dateIndex}`;
          const hours = numberValue(entry.hours);
          row[colKey] = Number((numberValue(row[colKey]) + hours).toFixed(2));
          row.total = Number((numberValue(row.total) + hours).toFixed(2));
          totalsByDate[colKey] = Number((numberValue(totalsByDate[colKey]) + hours).toFixed(2));
        }
      }
    }

    const rows = Array.from(rowsByLine.values()).sort((a, b) =>
      `${a.rubrique} ${a.projet} ${a.site}`.localeCompare(`${b.rubrique} ${b.projet} ${b.site}`, 'fr-FR'),
    );

    const baseName = safeSheetName(`TS ${fullName(user)}`, `Timesheet ${index + 1}`);
    let sheetName = baseName;
    let suffix = 2;
    while (usedSheetNames.has(sheetName)) {
      sheetName = safeSheetName(`${baseName} ${suffix}`, `Timesheet ${index + 1}`);
      suffix += 1;
    }
    usedSheetNames.add(sheetName);

    sheets.push({
      name: sheetName,
      preRows: [
        ['Nom', user?.lastName ?? ''],
        ['Prenom', user?.firstName ?? ''],
        ['Matr', user?.employeeProfile?.employeeNumber ?? ''],
        ['Periode', `${fmtDate(group.timesheets[0]?.periodStart)} - ${fmtDate(group.timesheets[group.timesheets.length - 1]?.periodEnd)}`],
      ],
      columns: [
        { header: 'Type / Tache', key: 'rubrique', width: 20 },
        { header: 'Projet', key: 'projet', width: 24 },
        { header: 'Site', key: 'site', width: 28 },
        { header: 'Description', key: 'description', width: 32 },
        ...dateColumns,
        { header: 'Total', key: 'total', width: 12, type: 'number', style: 'total' },
      ],
      rows,
      totals: {
        rubrique: 'Total',
        ...totalsByDate,
        total: Number(Object.values(totalsByDate).reduce((sum, value) => sum + numberValue(value), 0).toFixed(2)),
      },
    });
  }

  return sheets;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildTimesheetsSheetLegacy(data: any[]): ExcelSheet[] {
  // Feuille 1 : résumé
  const summaryRows = data.map((ts) => ({
    employe:    `${ts.user?.firstName ?? ''} ${ts.user?.lastName ?? ''}`.trim(),
    email:      ts.user?.email ?? '',
    debut:      fmtDate(ts.periodStart),
    fin:        fmtDate(ts.periodEnd),
    statut:     statusLabel(ts.status ?? ''),
    lignes:     ts.lines?.length ?? 0,
    heures:     (ts.lines?.reduce((s: number, l: { entries?: { durationMinutes?: number }[] }) =>
      s + (l.entries?.reduce((es: number, e: { durationMinutes?: number }) => es + (e.durationMinutes ?? 0), 0) ?? 0), 0) ?? 0) / 60,
  }));

  // Feuille 2 : détail par ligne
  const detailRows: Record<string, CellValue>[] = [];
  for (const ts of data) {
    const empName = `${ts.user?.firstName ?? ''} ${ts.user?.lastName ?? ''}`.trim();
    for (const line of (ts.lines ?? [])) {
      for (const entry of (line.entries ?? [])) {
        detailRows.push({
          employe:  empName,
          site: line.site?.name ?? '—',
          code:     line.site?.code ?? '',
          date:     fmtDate(entry.workDate),
          heures:   fmtHours(entry.durationMinutes),
          type:     entry.entryType ?? '',
          note:     entry.note ?? '',
          statut:   statusLabel(ts.status ?? ''),
        });
      }
    }
  }

  return [
    {
      name: 'Feuilles de temps',
      columns: [
        { header: 'Employé',        key: 'employe',  width: 24 },
        { header: 'Email',          key: 'email',    width: 28 },
        { header: 'Période début',  key: 'debut',    width: 16 },
        { header: 'Période fin',    key: 'fin',      width: 16 },
        { header: 'Statut',         key: 'statut',   width: 14 },
        { header: 'Nb lignes',      key: 'lignes',   width: 10, type: 'number' },
        { header: 'Heures totales', key: 'heures',   width: 14, type: 'number' },
      ],
      rows: summaryRows,
      totals: {
        employe: `${summaryRows.length} feuille(s)`,
        heures:  Number(summaryRows.reduce((s, r) => s + (r.heures as number), 0).toFixed(2)),
      },
    },
    {
      name: 'Détail des entrées',
      columns: [
        { header: 'Employé',    key: 'employe',  width: 24 },
        { header: 'Site',   key: 'site', width: 24 },
        { header: 'Code',       key: 'code',     width: 12 },
        { header: 'Date',       key: 'date',     width: 14 },
        { header: 'Heures',     key: 'heures',   width: 10, type: 'number' },
        { header: 'Type',       key: 'type',     width: 14 },
        { header: 'Note',       key: 'note',     width: 32 },
        { header: 'Statut TS',  key: 'statut',   width: 14 },
      ],
      rows: detailRows,
    },
  ];
}

// ─── Résumé des congés ────────────────────────────────────────────────────────

export function buildLeaveSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((l) => ({
    employe:  `${l.user?.firstName ?? ''} ${l.user?.lastName ?? ''}`.trim(),
    email:    l.user?.email ?? '',
    type:     l.leaveType?.name ?? '',
    code:     l.leaveType?.code ?? '',
    debut:    fmtDate(l.startDate),
    fin:      fmtDate(l.endDate),
    duree:    l.durationDays ?? 0,
    statut:   statusLabel(l.status ?? ''),
    commentaire: l.comment ?? '',
  }));

  const totalDays = rows.reduce((s, r) => s + (r.duree as number), 0);

  return [{
    name: 'Congés',
    columns: [
      { header: 'Employé',      key: 'employe',     width: 24 },
      { header: 'Email',        key: 'email',       width: 28 },
      { header: 'Type de congé',key: 'type',        width: 20 },
      { header: 'Code',         key: 'code',        width: 12 },
      { header: 'Début',        key: 'debut',       width: 14 },
      { header: 'Fin',          key: 'fin',         width: 14 },
      { header: 'Durée (j)',    key: 'duree',       width: 12, type: 'number' },
      { header: 'Statut',       key: 'statut',      width: 14 },
      { header: 'Commentaire',  key: 'commentaire', width: 32 },
    ],
    rows,
    totals: {
      employe: `${rows.length} demande(s)`,
      duree:   totalDays,
    },
  }];
}

// ─── Export paie ──────────────────────────────────────────────────────────────

export function buildPayrollSheet(data: any[]): ExcelSheet[] {
  // data = hoursByEmployee output
  const rows = data.map((r) => {
    const heures     = r.hours ?? 0;
    const tauxHoraire = r.user?.hourlyRate ?? 0;
    const heuresSup  = Math.max(0, heures - 9 * (r.punches ?? 0));
    const heuresNorm = heures - heuresSup;
    const montant    = Number((heuresNorm * tauxHoraire + heuresSup * tauxHoraire * 1.25).toFixed(2));

    return {
      matricule:    r.user?.employeeNumber ?? '',
      employe:      `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
      email:        r.user?.email ?? '',
      poste:        r.user?.jobTitle ?? '',
      pointages:    r.punches ?? 0,
      heuresTotal:  Number(heures.toFixed(2)),
      heuresNorm:   Number(heuresNorm.toFixed(2)),
      heuresSup:    Number(heuresSup.toFixed(2)),
      tauxHoraire:  tauxHoraire,
      montant:      montant,
    };
  });

  const totalMontant = rows.reduce((s, r) => s + (r.montant as number), 0);
  const totalHeures  = rows.reduce((s, r) => s + (r.heuresTotal as number), 0);

  return [{
    name: 'Export paie',
    columns: [
      { header: 'Matricule',          key: 'matricule',  width: 14 },
      { header: 'Employé',            key: 'employe',    width: 24 },
      { header: 'Email',              key: 'email',      width: 28 },
      { header: 'Poste',              key: 'poste',      width: 20 },
      { header: 'Nb pointages',       key: 'pointages',  width: 14, type: 'number' },
      { header: 'Heures totales',     key: 'heuresTotal',width: 14, type: 'number' },
      { header: 'Heures normales',    key: 'heuresNorm', width: 14, type: 'number' },
      { header: 'Heures sup.',        key: 'heuresSup',  width: 14, type: 'number' },
      { header: 'Taux horaire (MAD)', key: 'tauxHoraire',width: 18, type: 'number' },
      { header: 'Montant brut (MAD)', key: 'montant',    width: 18, type: 'number' },
    ],
    rows,
    totals: {
      employe:    `${rows.length} employé(s)`,
      heuresTotal: Number(totalHeures.toFixed(2)),
      montant:     Number(totalMontant.toFixed(2)),
    },
  }];
}
