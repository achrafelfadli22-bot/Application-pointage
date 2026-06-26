'use client';

import { useState } from 'react';
import {
  Download, Loader2, CalendarDays, Users, Building2,
  Umbrella, MapPinOff, CreditCard, CheckCircle2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { DateField, SelectField } from '@/components/ui/form-fields';
import { api, tokenStore, apiRequest } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';
import { cn } from '@/lib/utils';
import { downloadExcel } from '@/lib/excel-export';
import {
  buildAttendanceSheet,
  buildGpsAnomaliesSheet,
  buildHoursBySiteSheet,
  buildHoursByEmployeeSheet,
  buildTimesheetsSheet,
  buildLeaveSheet,
  buildPayrollSheet,
} from '@/lib/report-builders';

// ─── Définition des rapports ──────────────────────────────────────────────────

type RapportDef = {
  nom: string;
  endpoint: string;
  description: string;
  categorie: 'presence' | 'operations' | 'rh' | 'paie';
  icon: React.ElementType;
  roles: string[];
};

const RAPPORTS: RapportDef[] = [
  // Présence & Terrain
  {
    nom: 'Présence journalière',
    endpoint: 'attendance',          // GET /api/reports/attendance
    description: 'Liste des entrées/sorties par employé et par jour, avec statut de validation.',
    categorie: 'presence',
    icon: CalendarDays,
    roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'],
  },
  {
    nom: 'Anomalies GPS',
    endpoint: 'gps-anomalies',       // GET /api/reports/gps-anomalies
    description: 'Pointages hors périmètre chantier — à traiter avant validation.',
    categorie: 'presence',
    icon: MapPinOff,
    roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'],
  },
  // Opérations
  {
    nom: 'Heures par chantier',
    endpoint: 'hours-by-site',       // GET /api/reports/hours-by-site
    description: 'Total des heures travaillées ventilé par chantier sur la période.',
    categorie: 'operations',
    icon: Building2,
    roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'],
  },
  {
    nom: 'Feuilles de temps',
    endpoint: 'timesheets',          // GET /api/reports/timesheets
    description: 'Récapitulatif des feuilles de temps soumises et approuvées sur la période.',
    categorie: 'operations',
    icon: CheckCircle2,
    roles: ['MANAGER', 'PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'],
  },
  // RH
  {
    nom: 'Heures par employé',
    endpoint: 'hours-by-employee',   // GET /api/reports/hours-by-employee
    description: 'Récapitulatif des heures effectuées par chaque collaborateur.',
    categorie: 'rh',
    icon: Users,
    roles: ['HR', 'RESOURCE_MANAGER'],
  },
  {
    nom: 'Résumé des congés',
    endpoint: 'leave',               // GET /api/reports/leave
    description: 'Soldes, congés pris et demandes en cours — par employé et par type.',
    categorie: 'rh',
    icon: Umbrella,
    roles: ['HR', 'RESOURCE_MANAGER'],
  },
  // Paie
  {
    nom: 'Export paie',
    endpoint: 'payroll-export',      // GET /api/reports/payroll-export
    description: 'Fichier de paie prêt à importer : heures, primes, absences déduites.',
    categorie: 'paie',
    icon: CreditCard,
    roles: ['HR', 'RESOURCE_MANAGER'],
  },
];

const CATEGORIES: { key: RapportDef['categorie']; label: string; color: string; bg: string }[] = [
  { key: 'presence',   label: 'Présence & Terrain', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  { key: 'operations', label: 'Opérations',          color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  { key: 'rh',         label: 'RH',                  color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  { key: 'paie',       label: 'Paie',                color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
];

// ─── Raccourcis de période ────────────────────────────────────────────────────

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

const PRESETS = [
  {
    label: 'Cette semaine',
    get() {
      const today = new Date();
      const monday = new Date(today);
      monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
      return { from: isoDate(monday), to: isoDate(today) };
    },
  },
  {
    label: 'Semaine dernière',
    get() {
      const today = new Date();
      const lastMonday = new Date(today);
      lastMonday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7) - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
      return { from: isoDate(lastMonday), to: isoDate(lastSunday) };
    },
  },
  {
    label: 'Ce mois',
    get() {
      const today = new Date();
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return { from: isoDate(first), to: isoDate(today) };
    },
  },
  {
    label: 'Mois dernier',
    get() {
      const today = new Date();
      const firstLast = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const lastLast  = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      return { from: isoDate(firstLast), to: isoDate(lastLast) };
    },
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

type Site = { id: string; code: string; name: string };
type Employee = { id: string; firstName: string; lastName: string };

export default function ReportsPage() {
  const myRole = tokenStore.session?.role ?? '';
  const visibleRapports = RAPPORTS.filter((r) => r.roles.includes(myRole) || (myRole === 'EMPLOYEE' && r.endpoint === 'timesheets'));

  const [loading, setLoading]       = useState<string | null>(null);
  const [exported, setExported]     = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [siteId, setSiteId]         = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const canFilterSites = myRole !== 'EMPLOYEE';
  const canFilterEmployees = ['PROJECT_MANAGER', 'HR', 'RESOURCE_MANAGER'].includes(myRole);

  const { data: sites }     = useApiData<Site[]>(() => (canFilterSites ? api.sites() as Promise<Site[]> : Promise.resolve([])), []);
  const { data: employees } = useApiData<Employee[]>(() => (canFilterEmployees ? api.employees() as Promise<Employee[]> : Promise.resolve([])), []);

  function applyPreset(preset: typeof PRESETS[number]) {
    const { from, to } = preset.get();
    setDateFrom(from);
    setDateTo(to);
    setExported(null);
    setExportError(null);
  }

  async function handleExport(rapport: RapportDef) {
    setLoading(rapport.endpoint);
    setExported(null);
    setExportError(null);
    try {
      // Build query string using the same param names as the backend DTO
      const params = new URLSearchParams();
      if (dateFrom)   params.set('startDate',  dateFrom);
      if (dateTo)     params.set('endDate',    dateTo);
      if (siteId)     params.set('siteId',     siteId);
      if (employeeId) params.set('userId',     employeeId);

      const qs = params.toString() ? `?${params}` : '';

      // Fetch JSON from backend
      const data = await apiRequest<any[]>(`/reports/${rapport.endpoint}${qs}`);

      // Convert to Excel sheets
      const builders: Record<string, (d: unknown[]) => ReturnType<typeof buildAttendanceSheet>> = {
        'attendance':       buildAttendanceSheet,
        'gps-anomalies':    buildGpsAnomaliesSheet,
        'hours-by-site':    buildHoursBySiteSheet,
        'hours-by-employee':buildHoursByEmployeeSheet,
        'timesheets':       buildTimesheetsSheet,
        'leave':            buildLeaveSheet,
        'payroll-export':   buildPayrollSheet,
      };

      const builder = builders[rapport.endpoint];
      if (!builder) throw new Error(`Aucun builder pour "${rapport.endpoint}"`);

      const rows = Array.isArray(data) ? data : data ? [data] : [];
      if (rows.length === 0) {
        throw new Error("Aucune donnee pour cette periode - l'export serait vide.");
      }

      const sheets = builder(rows);
      if (!sheets.some((sheet) => sheet.rows.length > 0)) {
        throw new Error("Aucune donnee exploitable pour cette periode - l'export serait vide.");
      }

      const filename = rapport.endpoint === 'timesheets'
        ? `modele-timesheets-${new Date().toISOString().slice(0, 10)}.xlsx`
        : `${rapport.endpoint}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      downloadExcel(sheets, filename);

      setExported(rapport.endpoint);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Erreur lors de l'export");
    } finally {
      setLoading(null);
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Rapports"
          description="Exportez vos donnees RH, presence, paie et chantiers au format Excel."
        />

        {/* Filtres globaux */}
        <div className="rounded-xl border border-borderSoft bg-surface p-4 shadow-card">
          {/* Raccourcis période */}
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-mutedText">Période :</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-md border border-borderSoft px-3 py-1 text-xs font-medium text-bodyText transition-colors hover:bg-accentLight hover:border-accent hover:text-accentText"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date pickers + selects */}
          <div className="grid gap-3 md:grid-cols-4">
            <DateField label="Date début" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <DateField label="Date fin"   value={dateTo}   onChange={(e) => setDateTo(e.target.value)} />
            {canFilterSites ? (
              <SelectField label="Chantier" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">Tous les chantiers</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </SelectField>
            ) : (
              <div className="hidden md:block" />
            )}
            {canFilterEmployees && (
              <SelectField label="Employé" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Tous les employés</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </SelectField>
            )}
          </div>
        </div>

        {/* Feedback export */}
        {exportError && (
          <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
            {exportError}
          </div>
        )}
        {exported && !exportError && (
          <div className="flex items-center gap-2 rounded-lg border border-successBorder bg-successBg px-4 py-3 text-sm text-successText">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Rapport téléchargé avec succès.
          </div>
        )}

        {/* Cartes par catégorie */}
        {CATEGORIES.map((cat) => {
          const items = visibleRapports.filter((r) => r.categorie === cat.key);
          if (items.length === 0) return null;
          return (
            <section key={cat.key} className="grid gap-3">
              <div className="flex items-center gap-2">
                <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', cat.bg, cat.color)}>
                  {cat.label}
                </span>
                <div className="h-px flex-1 bg-borderSoft" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((rapport) => {
                  const Icon = rapport.icon;
                  const isLoading = loading === rapport.endpoint;
                  const done      = exported === rapport.endpoint;
                  return (
                    <div
                      key={rapport.endpoint}
                      className="flex flex-col gap-4 rounded-xl border border-borderSoft bg-surface p-5 shadow-card transition-shadow hover:shadow-dropdown"
                    >
                      {/* En-tête */}
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', cat.bg, cat.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-bodyText">{rapport.nom}</p>
                          <p className="mt-0.5 text-xs text-mutedText leading-relaxed">{rapport.description}</p>
                        </div>
                      </div>

                      {/* Pied */}
                      <div className="flex items-center justify-between border-t border-borderSoft pt-3">
                        {done ? (
                          <span className="flex items-center gap-1 text-xs text-successText">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Exporté
                          </span>
                        ) : (
                          <span className="text-xs text-hintText">
                            {dateFrom && dateTo
                              ? `${new Date(dateFrom).toLocaleDateString('fr-FR')} → ${new Date(dateTo).toLocaleDateString('fr-FR')}`
                              : 'Toutes les dates'}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={!!loading}
                          onClick={() => handleExport(rapport)}
                          className={cn(
                            'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
                            isLoading
                              ? 'border-borderSoft bg-surface text-mutedText'
                              : 'border-borderSoft bg-surface text-bodyText hover:bg-accentLight hover:border-accent hover:text-accentText',
                          )}
                        >
                          {isLoading
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération…</>
                            : <><Download className="h-3.5 w-3.5" /> Télécharger Excel</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
