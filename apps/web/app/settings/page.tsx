'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DateField, FormField, SelectField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { api, tokenStore } from '@/lib/api-client';
import {
  DEFAULT_TIMESHEET_TASK_TYPES,
  normalizeTaskTypeValue,
  type TimesheetTaskType,
} from '@/lib/timesheet-task-types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  status: string;
};

type Holiday = {
  id: string;
  name: string;
  date: string;
  country: string;
  isRecurring: boolean;
};

type LeaveType = {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  annualAllowanceDays: number;
  requiresApproval: boolean;
  status: string;
};

// ─── Demo fallbacks ───────────────────────────────────────────────────────────

const demoCompany: Company = {
  id: 'demo',
  name: 'Futura Expertise',
  email: 'contact@futura-expert.com',
  phone: '+212 6 61 64 00 26',
  address: 'N 18 Office JAD, Bd Moulouya, El Oulfa',
  city: 'Casablanca',
  country: 'Maroc',
  status: 'ACTIVE',
};

const demoHolidays: Holiday[] = [
  { id: 'h1', name: 'Fete du Travail', date: '2026-05-01', country: 'MA', isRecurring: true },
  { id: 'h2', name: 'Fete Nationale', date: '2026-07-30', country: 'MA', isRecurring: true },
  { id: 'h3', name: 'Aid Al Adha', date: '2026-06-16', country: 'MA', isRecurring: false },
];

const demoLeaveTypes: LeaveType[] = [
  { id: 'lt1', code: 'MAR-AL', name: '[MAR] Annual Leave', isPaid: true, annualAllowanceDays: 18, requiresApproval: true, status: 'ACTIVE' },
  { id: 'lt2', code: 'MAR-SL', name: '[MAR] Sick Leave', isPaid: true, annualAllowanceDays: 6, requiresApproval: false, status: 'ACTIVE' },
  { id: 'lt3', code: 'MAR-ML', name: '[MAR] Maternity Leave', isPaid: true, annualAllowanceDays: 98, requiresApproval: true, status: 'ACTIVE' },
];

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = ['Societe', 'Jours feries', 'Types de conges', 'Types timesheet', 'Chantiers', 'Pointage'] as const;
type Tab = (typeof TABS)[number];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-borderSoft">
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
            active === t
              ? 'border-b-2 border-accent text-accentText'
              : 'text-mutedText hover:text-bodyText'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Company tab ─────────────────────────────────────────────────────────────

function CompanyTab() {
  const [company, setCompany] = useState<Company>(demoCompany);
  const [form, setForm] = useState<Company>(demoCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settingsCompany()
      .then((data) => {
        const c = data as Company;
        setCompany(c);
        setForm(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await api.updateSettingsCompany(form as unknown as Record<string, unknown>);
      setCompany(updated as Company);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-mutedText">Chargement…</div>;
  }

  const field = (key: keyof Company, label: string, type = 'text') => (
    <FormField
      label={label}
      type={type}
      value={form[key] ?? ''}
      onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
    />
  );

  return (
    <div className="grid gap-6 py-6">
      <div className="grid gap-4 md:grid-cols-2">
        {field('name', 'Nom de la société')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Téléphone')}
        {field('address', 'Adresse')}
        {field('city', 'Ville')}
        {field('country', 'Pays (code ISO)')}
      </div>

      <div className="flex items-center gap-3">
        <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </PrimaryButton>
        {success && <span className="text-sm font-semibold text-green-600">Modifié avec succès ✓</span>}
        {error && <span className="text-sm text-dangerText">{error}</span>}
      </div>

      <div className="grid gap-2 border-t border-borderSoft pt-4">
        <div className="text-xs font-semibold uppercase text-mutedText">Statut du compte</div>
        <StatusBadge status={company.status} />
      </div>
    </div>
  );
}

// ─── Holidays tab ─────────────────────────────────────────────────────────────

type HolidayForm = Omit<Holiday, 'id'>;
const emptyHoliday: HolidayForm = { name: '', date: '', country: 'MA', isRecurring: false };

function HolidaysTab() {
  const [holidays, setHolidays] = useState<Holiday[]>(demoHolidays);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayForm>(emptyHoliday);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settingsHolidays()
      .then((data) => setHolidays(data as Holiday[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyHoliday);
    setShowForm(true);
    setError(null);
  }

  function openEdit(h: Holiday) {
    setEditing(h);
    setForm({ name: h.name, date: h.date.slice(0, 10), country: h.country, isRecurring: h.isRecurring });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyHoliday);
    setError(null);
  }

  async function handleSubmit() {
    if (!form.name || !form.date || !form.country) {
      setError('Nom, date et pays sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const updated = await api.updateHoliday(editing.id, form as unknown as Record<string, unknown>);
        setHolidays((prev) => prev.map((h) => (h.id === editing.id ? (updated as Holiday) : h)));
      } else {
        const created = await api.createHoliday(form as unknown as Record<string, unknown>);
        setHolidays((prev) => [...prev, created as Holiday]);
      }
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce jour férié ?')) return;
    try {
      await api.deleteHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    }
  }

  return (
    <div className="grid gap-4 py-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mutedText">
          {holidays.length} jour{holidays.length !== 1 ? 's' : ''} férié{holidays.length !== 1 ? 's' : ''} configuré{holidays.length !== 1 ? 's' : ''}
        </p>
        <PrimaryButton type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ajouter
        </PrimaryButton>
      </div>

      {showForm && (
        <div className="border border-borderSoft bg-surfaceHover p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-bodyText">{editing ? 'Modifier le jour férié' : 'Nouveau jour férié'}</span>
            <button type="button" onClick={closeForm}>
              <X className="h-4 w-4 text-mutedText" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <FormField
              label="Nom"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <DateField
              label="Date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            />
            <FormField
              label="Pays (ISO)"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
            />
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-bodyText">Récurrent</span>
              <select
                value={form.isRecurring ? 'true' : 'false'}
                onChange={(e) => setForm((p) => ({ ...p, isRecurring: e.target.value === 'true' }))}
                className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
              >
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </label>
          </div>
          {error && <p className="mt-2 text-sm text-dangerText">{error}</p>}
          <div className="mt-3 flex gap-2">
            <PrimaryButton type="button" onClick={handleSubmit} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={closeForm}>
              Annuler
            </SecondaryButton>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-mutedText">Chargement…</div>
      ) : (
        <div className="overflow-x-auto border border-borderSoft bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-borderSoft bg-surfaceHover text-left text-xs font-bold uppercase text-mutedText">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Pays</th>
                <th className="px-4 py-3">Récurrent</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="border-b border-borderSoft last:border-0 hover:bg-surfaceHover">
                  <td className="px-4 py-3 font-semibold text-bodyText">{h.name}</td>
                  <td className="px-4 py-3 text-bodyText">{new Date(h.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-bodyText">{h.country}</td>
                  <td className="px-4 py-3">{h.isRecurring ? 'Oui' : 'Non'}</td>
                  <td className="flex gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(h)}
                      className="text-bodyText hover:text-accentText"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id)}
                      className="text-dangerText hover:opacity-70"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-mutedText">
                    Aucun jour férié configuré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Leave Types tab ──────────────────────────────────────────────────────────

type LeaveTypeForm = Omit<LeaveType, 'id'>;
const emptyLeaveType: LeaveTypeForm = {
  code: '',
  name: '',
  isPaid: true,
  annualAllowanceDays: 0,
  requiresApproval: true,
  status: 'ACTIVE',
};

function LeaveTypesTab() {
  const [types, setTypes] = useState<LeaveType[]>(demoLeaveTypes);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>(emptyLeaveType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settingsLeaveTypes()
      .then((data) => setTypes(data as LeaveType[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyLeaveType);
    setShowForm(true);
    setError(null);
  }

  function openEdit(lt: LeaveType) {
    setEditing(lt);
    setForm({
      code: lt.code,
      name: lt.name,
      isPaid: lt.isPaid,
      annualAllowanceDays: lt.annualAllowanceDays,
      requiresApproval: lt.requiresApproval,
      status: lt.status,
    });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(emptyLeaveType);
    setError(null);
  }

  async function handleSubmit() {
    if (!form.code || !form.name) {
      setError('Code et nom sont obligatoires.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const updated = await api.updateLeaveType(editing.id, form as unknown as Record<string, unknown>);
        setTypes((prev) => prev.map((lt) => (lt.id === editing.id ? (updated as LeaveType) : lt)));
      } else {
        const created = await api.createLeaveType(form as unknown as Record<string, unknown>);
        setTypes((prev) => [...prev, created as LeaveType]);
      }
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  const boolSelect = (
    key: 'isPaid' | 'requiresApproval',
    label: string,
  ) => (
    <label className="grid gap-1">
      <span className="text-sm font-semibold text-bodyText">{label}</span>
      <select
        value={form[key] ? 'true' : 'false'}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value === 'true' }))}
        className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
      >
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    </label>
  );

  return (
    <div className="grid gap-4 py-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mutedText">
          {types.length} type{types.length !== 1 ? 's' : ''} de congé configuré{types.length !== 1 ? 's' : ''}
        </p>
        <PrimaryButton type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ajouter
        </PrimaryButton>
      </div>

      {showForm && (
        <div className="border border-borderSoft bg-surfaceHover p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-bodyText">{editing ? 'Modifier le type de congé' : 'Nouveau type de congé'}</span>
            <button type="button" onClick={closeForm}>
              <X className="h-4 w-4 text-mutedText" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField
              label="Code"
              placeholder="ex: MAR-AL"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            />
            <FormField
              label="Nom"
              placeholder="ex: Annual Leave"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <FormField
              label="Jours annuels"
              type="number"
              min={0}
              value={form.annualAllowanceDays}
              onChange={(e) => setForm((p) => ({ ...p, annualAllowanceDays: Number(e.target.value) }))}
            />
            {boolSelect('isPaid', 'Payé')}
            {boolSelect('requiresApproval', 'Approbation requise')}
            <SelectField
              label="Statut"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </SelectField>
          </div>
          {error && <p className="mt-2 text-sm text-dangerText">{error}</p>}
          <div className="mt-3 flex gap-2">
            <PrimaryButton type="button" onClick={handleSubmit} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={closeForm}>
              Annuler
            </SecondaryButton>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-mutedText">Chargement…</div>
      ) : (
        <div className="overflow-x-auto border border-borderSoft bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-borderSoft bg-surfaceHover text-left text-xs font-bold uppercase text-mutedText">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Jours/an</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Approbation</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((lt) => (
                <tr key={lt.id} className="border-b border-borderSoft last:border-0 hover:bg-surfaceHover">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-accent">{lt.code}</td>
                  <td className="px-4 py-3 font-semibold text-bodyText">{lt.name}</td>
                  <td className="px-4 py-3 text-bodyText">{lt.annualAllowanceDays}</td>
                  <td className="px-4 py-3">{lt.isPaid ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-3">{lt.requiresApproval ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lt.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(lt)}
                      className="text-bodyText hover:text-accentText"
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-mutedText">
                    Aucun type de congé configuré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Settings tab ──────────────────────────────────────────────────

type TimesheetTaskTypeForm = TimesheetTaskType;
type TimesheetPeriodType = 'WEEKLY' | 'MONTHLY';
type TimesheetSettings = { timesheetPeriod: TimesheetPeriodType; timesheetPeriodDays: number };
type SiteOptions = { siteRoleOptions: string[]; clientOptions: string[] };

const emptyTimesheetTaskType: TimesheetTaskTypeForm = {
  value: '',
  label: '',
  isActive: true,
};

const defaultSiteRoleOptions = [
  'Chef de site',
  'Chef d equipe',
  'Technicien',
  'Electricien',
  'Aide electricien',
  'Controle qualite',
  'HSE',
  'Administratif chantier',
];

function TimesheetTaskTypesTab() {
  const canEdit = tokenStore.session?.role === 'RESOURCE_MANAGER';
  const [types, setTypes] = useState<TimesheetTaskType[]>(DEFAULT_TIMESHEET_TASK_TYPES);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<TimesheetTaskTypeForm>(emptyTimesheetTaskType);
  const [timesheetPeriod, setTimesheetPeriod] = useState<TimesheetPeriodType>('WEEKLY');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.settingsTimesheetTaskTypes(), api.settingsTimesheet()])
      .then(([taskTypesData, settingsData]) => {
        const settings = settingsData as TimesheetSettings;
        setTypes(taskTypesData as TimesheetTaskType[]);
        setTimesheetPeriod(settings.timesheetPeriod ?? 'WEEKLY');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditingIndex(null);
    setForm(emptyTimesheetTaskType);
    setShowForm(true);
    setError(null);
  }

  function openEdit(taskType: TimesheetTaskType, index: number) {
    setEditingIndex(index);
    setForm(taskType);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingIndex(null);
    setForm(emptyTimesheetTaskType);
    setError(null);
  }

  function handleSubmit() {
    if (!canEdit) {
      setError('Seul le Ressource Manager peut modifier les types timesheet.');
      return;
    }

    const value = normalizeTaskTypeValue(form.value || form.label);
    const label = form.label.trim();

    if (!value || !label) {
      setError('Code et libelle sont obligatoires.');
      return;
    }

    const duplicate = types.some((taskType, index) => taskType.value === value && index !== editingIndex);
    if (duplicate) {
      setError('Ce code existe deja.');
      return;
    }

    const nextType: TimesheetTaskType = { value, label, isActive: form.isActive };
    setTypes((previous) =>
      editingIndex === null
        ? [...previous, nextType]
        : previous.map((taskType, index) => (index === editingIndex ? nextType : taskType)),
    );
    closeForm();
  }

  function handleDelete(indexToDelete: number) {
    if (!canEdit) return;
    if (!confirm('Supprimer ce type timesheet ? Les anciennes lignes garderont leur code historique.')) return;
    setTypes((previous) => previous.filter((_, index) => index !== indexToDelete));
  }

  async function handleSave() {
    if (!canEdit) {
      setError('Seul le Ressource Manager peut enregistrer ces parametres.');
      return;
    }

    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const [updated, updatedSettings] = await Promise.all([
        api.updateSettingsTimesheetTaskTypes({ types }),
        api.updateSettingsTimesheet({ timesheetPeriod: timesheetPeriod }),
      ]);
      setTypes(updated as TimesheetTaskType[]);
      setTimesheetPeriod((updatedSettings as TimesheetSettings).timesheetPeriod ?? 'WEEKLY');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-mutedText">
          {types.length} type{types.length !== 1 ? 's' : ''} timesheet configure{types.length !== 1 ? 's' : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <PrimaryButton type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Ajouter
            </PrimaryButton>
          )}
          <SecondaryButton type="button" onClick={handleSave} disabled={saving || !canEdit}>
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </SecondaryButton>
        </div>
      </div>

      {!canEdit && (
        <div className="border border-borderSoft bg-grayCard px-4 py-3 text-sm text-mutedText">
          Liste en lecture seule. La modification est reservee au Ressource Manager.
        </div>
      )}

      <div className="border border-borderSoft bg-surfaceHover p-4">
        <p className="mb-3 text-sm font-semibold text-bodyText">Périodicité des timesheets</p>
        <div className="flex gap-4">
          {(
            [
              { value: 'WEEKLY',  label: 'Hebdomadaire', desc: '7 jours par timesheet' },
              { value: 'MONTHLY', label: 'Mensuelle',    desc: '30 jours par timesheet' },
            ] as { value: TimesheetPeriodType; label: string; desc: string }[]
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 px-4 py-3 transition-colors ${
                !canEdit ? 'cursor-default opacity-60' : ''
              } ${
                timesheetPeriod === option.value
                  ? 'border-accent bg-accentLight'
                  : 'border-borderSoft bg-surface hover:border-accent/40'
              }`}
            >
              <input
                type="radio"
                name="timesheetPeriod"
                value={option.value}
                checked={timesheetPeriod === option.value}
                disabled={!canEdit}
                onChange={() => setTimesheetPeriod(option.value)}
                className="mt-0.5 accent-accent"
              />
              <div>
                <p className="text-sm font-semibold text-bodyText">{option.label}</p>
                <p className="text-xs text-mutedText">{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="border border-borderSoft bg-surfaceHover p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-bodyText">
              {editingIndex === null ? 'Nouveau type timesheet' : 'Modifier le type timesheet'}
            </span>
            <button type="button" onClick={closeForm}>
              <X className="h-4 w-4 text-mutedText" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField
              label="Code"
              placeholder="ex: EXECUTION"
              value={form.value}
              onChange={(e) => setForm((p) => ({ ...p, value: normalizeTaskTypeValue(e.target.value) }))}
            />
            <FormField
              label="Libelle"
              placeholder="ex: Execution travaux"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            />
            <SelectField
              label="Statut"
              value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'ACTIVE' }))}
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </SelectField>
          </div>
          {error && <p className="mt-2 text-sm text-dangerText">{error}</p>}
          <div className="mt-3 flex gap-2">
            <PrimaryButton type="button" onClick={handleSubmit}>
              <Save className="h-4 w-4" />
              Valider
            </PrimaryButton>
            <SecondaryButton type="button" onClick={closeForm}>
              Annuler
            </SecondaryButton>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-mutedText">Chargement...</div>
      ) : (
        <div className="overflow-x-auto border border-borderSoft bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-borderSoft bg-surfaceHover text-left text-xs font-bold uppercase text-mutedText">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Libelle</th>
                <th className="px-4 py-3">Statut</th>
                {canEdit && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {types.map((taskType, index) => (
                <tr key={taskType.value} className="border-b border-borderSoft last:border-0 hover:bg-surfaceHover">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-accent">{taskType.value}</td>
                  <td className="px-4 py-3 font-semibold text-bodyText">{taskType.label}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={taskType.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  {canEdit && (
                    <td className="flex gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(taskType, index)}
                        className="text-bodyText hover:text-accentText"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="text-dangerText hover:opacity-70"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-mutedText">
                    Aucun type timesheet configure.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        {success && <span className="text-sm font-semibold text-green-600">Modifie avec succes</span>}
        {error && !showForm && <span className="text-sm text-dangerText">{error}</span>}
      </div>
    </div>
  );
}

function SiteOptionsTab() {
  const canEdit = tokenStore.session?.role === 'RESOURCE_MANAGER';
  const [siteRoleOptions, setSiteRoleOptions] = useState<string[]>(defaultSiteRoleOptions);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [siteRoleInput, setSiteRoleInput] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settingsSiteOptions()
      .then((data) => {
        const options = data as SiteOptions;
        setSiteRoleOptions(options.siteRoleOptions?.length ? options.siteRoleOptions : defaultSiteRoleOptions);
        setClientOptions(options.clientOptions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function normalizeOptions(options: string[]) {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const option of options) {
      const value = option.trim();
      if (!value) continue;

      const key = value.toLocaleLowerCase('fr-FR');
      if (seen.has(key)) continue;

      seen.add(key);
      normalized.push(value);
    }

    return normalized;
  }

  function addOption(kind: 'role' | 'client') {
    if (!canEdit) return;

    const value = (kind === 'role' ? siteRoleInput : clientInput).trim();
    if (!value) return;

    const options = kind === 'role' ? siteRoleOptions : clientOptions;
    const duplicate = options.some((option) => option.toLocaleLowerCase('fr-FR') === value.toLocaleLowerCase('fr-FR'));
    if (duplicate) {
      setError('Cette option existe deja.');
      return;
    }

    if (kind === 'role') {
      setSiteRoleOptions((previous) => [...previous, value]);
      setSiteRoleInput('');
    } else {
      setClientOptions((previous) => [...previous, value]);
      setClientInput('');
    }
    setError(null);
  }

  function updateOption(kind: 'role' | 'client', index: number, value: string) {
    if (!canEdit) return;
    const setter = kind === 'role' ? setSiteRoleOptions : setClientOptions;
    setter((previous) => previous.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  function deleteOption(kind: 'role' | 'client', index: number) {
    if (!canEdit) return;
    const setter = kind === 'role' ? setSiteRoleOptions : setClientOptions;
    setter((previous) => previous.filter((_, optionIndex) => optionIndex !== index));
  }

  async function handleSave() {
    if (!canEdit) {
      setError('Seul le Ressource Manager peut enregistrer ces parametres.');
      return;
    }

    const cleanedRoles = normalizeOptions(siteRoleOptions);
    const cleanedClients = normalizeOptions(clientOptions);

    if (!cleanedRoles.length) {
      setError('Au moins un role sur site est requis.');
      return;
    }

    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      const updated = (await api.updateSettingsSiteOptions({
        siteRoleOptions: cleanedRoles,
        clientOptions: cleanedClients,
      })) as SiteOptions;
      setSiteRoleOptions(updated.siteRoleOptions?.length ? updated.siteRoleOptions : defaultSiteRoleOptions);
      setClientOptions(updated.clientOptions ?? []);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function renderOptionGroup(
    title: string,
    options: string[],
    input: string,
    setInput: (value: string) => void,
    kind: 'role' | 'client',
  ) {
    return (
      <div className="grid gap-3 border border-borderSoft bg-surfaceHover p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-bodyText">{title}</p>
            <p className="mt-0.5 text-xs text-mutedText">{options.length} option{options.length !== 1 ? 's' : ''}</p>
          </div>
          {canEdit && (
            <SecondaryButton type="button" onClick={() => addOption(kind)}>
              <Plus className="h-4 w-4" />
              Ajouter
            </SecondaryButton>
          )}
        </div>

        {canEdit && (
          <FormField
            label="Nouvelle option"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addOption(kind);
              }
            }}
          />
        )}

        <div className="grid gap-2">
          {options.map((option, index) => (
            <div key={`${kind}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              {canEdit ? (
                <FormField
                  label={`Option ${index + 1}`}
                  value={option}
                  onChange={(event) => updateOption(kind, index, event.target.value)}
                />
              ) : (
                <div className="rounded-md border border-borderSoft bg-surface px-3 py-2 text-sm font-medium text-bodyText">
                  {option}
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteOption(kind, index)}
                  className="flex h-9 w-9 items-center justify-center self-end rounded-md border border-borderSoft text-dangerText hover:bg-dangerBg"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {options.length === 0 && (
            <div className="border border-dashed border-borderSoft px-4 py-6 text-center text-sm text-mutedText">
              Aucune option configuree.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-mutedText">Chargement...</div>;
  }

  return (
    <div className="grid gap-4 py-6">
      {!canEdit && (
        <div className="border border-borderSoft bg-grayCard px-4 py-3 text-sm text-mutedText">
          Liste en lecture seule. La modification est reservee au Ressource Manager.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {renderOptionGroup("Clients / Maitres d'ouvrage", clientOptions, clientInput, setClientInput, 'client')}
        {renderOptionGroup('Roles sur site', siteRoleOptions, siteRoleInput, setSiteRoleInput, 'role')}
      </div>

      <div className="flex items-center gap-3">
        <PrimaryButton type="button" onClick={handleSave} disabled={saving || !canEdit}>
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </PrimaryButton>
        {success && <span className="text-sm font-semibold text-green-600">Modifie avec succes</span>}
        {error && <span className="text-sm text-dangerText">{error}</span>}
      </div>
    </div>
  );
}

type AttendanceSettings = {
  workDayStartTime: string;       // "HH:MM"
  lateToleranceMinutes: number;
  gpsToleranceMeters: number;
  overtimeTriggerHours: number;
};

const demoAttendanceSettings: AttendanceSettings = {
  workDayStartTime: '08:00',
  lateToleranceMinutes: 15,
  gpsToleranceMeters: 200,
  overtimeTriggerHours: 9,
};

function AttendanceSettingsTab() {
  const [form, setForm] = useState<AttendanceSettings>(demoAttendanceSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .settingsAttendance()
      .then((data) => setForm(data as AttendanceSettings))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.updateSettingsAttendance(form as unknown as Record<string, unknown>);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-mutedText">Chargement…</div>;
  }

  return (
    <div className="grid gap-6 py-6">
      {/* Section header */}
      <div>
        <p className="text-sm font-semibold text-bodyText">Règles de pointage</p>
        <p className="mt-0.5 text-xs text-mutedText">Ces paramètres s'appliquent à l'ensemble des employés du tenant.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Heure de début journée */}
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-bodyText">Heure de début de journée</span>
          <span className="text-xs text-mutedText">Référence pour le calcul des retards.</span>
          <input
            type="time"
            value={form.workDayStartTime}
            onChange={(e) => setForm((p) => ({ ...p, workDayStartTime: e.target.value }))}
            className="h-10 rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText outline-none focus:border-accent"
          />
        </label>

        {/* Tolérance retard */}
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-bodyText">Tolérance retard (minutes)</span>
          <span className="text-xs text-mutedText">Un pointage dans ce délai après l'heure de début n'est pas marqué en retard.</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              value={form.lateToleranceMinutes}
              onChange={(e) => setForm((p) => ({ ...p, lateToleranceMinutes: Number(e.target.value) }))}
              className="h-10 w-28 rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText outline-none focus:border-accent"
            />
            <span className="text-sm text-mutedText">min</span>
          </div>
        </label>

        {/* Tolérance GPS */}
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-bodyText">Tolérance GPS par défaut (mètres)</span>
          <span className="text-xs text-mutedText">Rayon maximal autorisé depuis l'emplacement du chantier.</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={5000}
              step={50}
              value={form.gpsToleranceMeters}
              onChange={(e) => setForm((p) => ({ ...p, gpsToleranceMeters: Number(e.target.value) }))}
              className="h-10 w-28 rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText outline-none focus:border-accent"
            />
            <span className="text-sm text-mutedText">m</span>
          </div>
        </label>

        {/* Heures supplémentaires */}
        <label className="grid gap-1">
          <span className="text-sm font-semibold text-bodyText">Heures sup. déclenchées à partir de (h/jour)</span>
          <span className="text-xs text-mutedText">Les heures au-delà de ce seuil sont comptabilisées en heures supplémentaires.</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={form.overtimeTriggerHours}
              onChange={(e) => setForm((p) => ({ ...p, overtimeTriggerHours: Number(e.target.value) }))}
              className="h-10 w-28 rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText outline-none focus:border-accent"
            />
            <span className="text-sm text-mutedText">h / jour</span>
          </div>
        </label>
      </div>

      {/* Summary card */}
      <div className="rounded-lg border border-borderSoft bg-grayCard px-4 py-3 text-xs text-mutedText">
        <span className="font-semibold text-bodyText">Résumé actuel : </span>
        Début à <strong>{form.workDayStartTime}</strong>, retard toléré{' '}
        <strong>{form.lateToleranceMinutes} min</strong>, GPS{' '}
        <strong>{form.gpsToleranceMeters} m</strong>, heures sup. dès{' '}
        <strong>{form.overtimeTriggerHours} h/j</strong>.
      </div>

      <div className="flex items-center gap-3">
        <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </PrimaryButton>
        {success && <span className="text-sm font-semibold text-green-600">Modifié avec succès ✓</span>}
        {error && <span className="text-sm text-dangerText">{error}</span>}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Societe');

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Paramètres"
          description="Paramétrage tenant, jours fériés, types de congés, types timesheet, chantiers et règles de pointage."
        />
        <div className="border border-borderSoft bg-surface shadow-card">
          <TabBar active={tab} onChange={setTab} />
          <div className="px-6">
            {tab === 'Societe' && <CompanyTab />}
            {tab === 'Jours feries' && <HolidaysTab />}
            {tab === 'Types de conges' && <LeaveTypesTab />}
            {tab === 'Types timesheet' && <TimesheetTaskTypesTab />}
            {tab === 'Chantiers' && <SiteOptionsTab />}
            {tab === 'Pointage' && <AttendanceSettingsTab />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
