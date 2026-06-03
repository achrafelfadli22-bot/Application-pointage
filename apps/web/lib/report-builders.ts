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
  return map[s] ?? s;
}

// ─── Présence journalière ─────────────────────────────────────────────────────

export function buildAttendanceSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((p) => ({
    employe:  `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim(),
    email:    p.user?.email ?? '',
    chantier: p.site?.name ?? '—',
    code:     p.site?.code ?? '',
    date:     fmtDate(p.punchDate),
    entree:   fmtTime(p.checkInAt),
    sortie:   fmtTime(p.checkOutAt),
    duree:    fmtHours(p.durationMinutes),
    statut:   statusLabel(p.status ?? ''),
    latitude: p.latitude ?? '',
    longitude: p.longitude ?? '',
  }));

  return [{
    name: 'Présence',
    columns: [
      { header: 'Employé',         key: 'employe',    width: 22 },
      { header: 'Email',            key: 'email',      width: 28 },
      { header: 'Chantier',         key: 'chantier',   width: 24 },
      { header: 'Code chantier',    key: 'code',       width: 14 },
      { header: 'Date',             key: 'date',       width: 14 },
      { header: 'Entrée',           key: 'entree',     width: 10 },
      { header: 'Sortie',           key: 'sortie',     width: 10 },
      { header: 'Durée (h)',        key: 'duree',      width: 12, type: 'number' },
      { header: 'Statut',           key: 'statut',     width: 14 },
      { header: 'Latitude',         key: 'latitude',   width: 14 },
      { header: 'Longitude',        key: 'longitude',  width: 14 },
    ],
    rows,
    totals: {
      employe: `${rows.length} pointage(s)`,
      duree: rows.reduce((s, r) => s + (r.duree as number), 0),
    },
  }];
}

// ─── Anomalies GPS ────────────────────────────────────────────────────────────

export function buildGpsAnomaliesSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((p) => ({
    employe:   `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.trim(),
    email:     p.user?.email ?? '',
    date:      fmtDate(p.punchDate),
    heure:     fmtTime(p.checkInAt),
    chantier:  p.site?.name ?? '—',
    code:      p.site?.code ?? '',
    rayon:     p.site?.gpsRadiusMeters ?? '',
    latPointage:  p.latitude ?? '',
    lngPointage:  p.longitude ?? '',
    latChantier:  p.site?.latitude ?? '',
    lngChantier:  p.site?.longitude ?? '',
    statut:    statusLabel(p.status ?? ''),
  }));

  return [{
    name: 'Anomalies GPS',
    columns: [
      { header: 'Employé',           key: 'employe',      width: 22 },
      { header: 'Email',             key: 'email',        width: 28 },
      { header: 'Date',              key: 'date',         width: 14 },
      { header: 'Heure',             key: 'heure',        width: 10 },
      { header: 'Chantier',          key: 'chantier',     width: 24 },
      { header: 'Code',              key: 'code',         width: 12 },
      { header: 'Rayon autorisé (m)',key: 'rayon',        width: 18, type: 'number' },
      { header: 'Lat. pointage',     key: 'latPointage',  width: 16 },
      { header: 'Lng. pointage',     key: 'lngPointage',  width: 16 },
      { header: 'Lat. chantier',     key: 'latChantier',  width: 16 },
      { header: 'Lng. chantier',     key: 'lngChantier',  width: 16 },
      { header: 'Statut',            key: 'statut',       width: 14 },
    ],
    rows,
  }];
}

// ─── Heures par chantier ──────────────────────────────────────────────────────

export function buildHoursBySiteSheet(data: any[]): ExcelSheet[] {
  const rows = data.map((r) => ({
    code:      r.site?.code ?? '—',
    chantier:  r.site?.name ?? '—',
    ville:     r.site?.city ?? '',
    heures:    r.hours ?? 0,
    pointages: r.punches ?? 0,
  }));

  const totalH = rows.reduce((s, r) => s + (r.heures as number), 0);
  const totalP = rows.reduce((s, r) => s + (r.pointages as number), 0);

  return [{
    name: 'Heures par chantier',
    columns: [
      { header: 'Code chantier', key: 'code',      width: 16 },
      { header: 'Chantier',      key: 'chantier',  width: 28 },
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

// ─── Timesheets ───────────────────────────────────────────────────────────────

export function buildTimesheetsSheet(data: any[]): ExcelSheet[] {
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
          chantier: line.site?.name ?? '—',
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
      name: 'Timesheets',
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
        employe: `${summaryRows.length} timesheet(s)`,
        heures:  Number(summaryRows.reduce((s, r) => s + (r.heures as number), 0).toFixed(2)),
      },
    },
    {
      name: 'Détail des entrées',
      columns: [
        { header: 'Employé',    key: 'employe',  width: 24 },
        { header: 'Chantier',   key: 'chantier', width: 24 },
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
