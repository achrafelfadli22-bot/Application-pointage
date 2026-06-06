'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DataTable } from '@/components/ui/data-table';
import { FormField, SelectField, DateField } from '@/components/ui/form-fields';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressMeter } from '@/components/domain/progress-meter';
import { api, tokenStore } from '@/lib/api-client';
import { demoSites } from '@/lib/demo-data';
import { useApiData } from '@/lib/use-api-data';

type Site = (typeof demoSites)[number] & {
  project?: { id: string; code: string; name: string } | null;
};
type Project = { id: string; code: string; name: string };
type Employee = {
  id: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string; status?: string };
};
type SiteOptions = { siteRoleOptions: string[]; clientOptions: string[] };

// ─── Modal Nouveau Chantier ───────────────────────────────────────────────────

const emptyForm = {
  projectId: '', code: '', name: '', clientName: '', address: '', city: '', country: 'MA',
  managerId: '',
  startDate: '', plannedEndDate: '',
  progressPercent: 0,
  latitude: '', longitude: '', gpsRadiusMeters: 200,
  status: 'ACTIVE',
};

function NewSiteModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: projects } = useApiData<Project[]>(() => api.projects() as Promise<Project[]>, []);
  const { data: employees } = useApiData<Employee[]>(() => api.employees() as Promise<Employee[]>, []);
  const { data: siteOptions } = useApiData<SiteOptions>(
    () => api.settingsSiteOptions() as Promise<SiteOptions>,
    { siteRoleOptions: [], clientOptions: [] },
  );
  const managerOptions = employees
    .filter((employee) => employee.status === 'ACTIVE')
    .filter((employee) => employee.user.status !== 'INACTIVE')
    .filter((employee) => employee.user.role === 'MANAGER');
  const clientOptions = siteOptions.clientOptions ?? [];

  function f(key: keyof typeof emptyForm, label: string, type = 'text', placeholder?: string) {
    return (
      <FormField
        label={label}
        type={type}
        placeholder={placeholder}
        value={String(form[key])}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            [key]: type === 'number' ? Number(e.target.value) : e.target.value,
          }))
        }
      />
    );
  }

  async function handleSubmit() {
    if (!form.code || !form.name || !form.clientName) {
      setError('Code, nom et client sont obligatoires.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.projectId) delete payload['projectId'];
      if (!form.managerId) delete payload['managerId'];
      if (form.latitude) payload['latitude'] = Number(form.latitude);
      else delete payload['latitude'];
      if (form.longitude) payload['longitude'] = Number(form.longitude);
      else delete payload['longitude'];
      if (!form.startDate) delete payload['startDate'];
      if (!form.plannedEndDate) delete payload['plannedEndDate'];
      await api.createSite(payload);
      setOpen(false);
      setForm(emptyForm);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setError(null); } }}>
      <Dialog.Trigger asChild>
        <PrimaryButton type="button"><Plus className="h-4 w-4" /> Nouveau chantier</PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(680px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Nouveau chantier</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Projet" value={form.projectId} onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}>
                <option value="">Sans projet</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </option>
                ))}
              </SelectField>
              {f('code',        'Code chantier',     'text', 'ex: CH-003')}
              {f('name',        'Nom du chantier')}
              <SelectField label="Client / Maitre d'ouvrage" value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}>
                <option value="">Selectionner</option>
                {clientOptions.map((client) => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Chef de site" value={form.managerId} onChange={(e) => setForm((p) => ({ ...p, managerId: e.target.value }))}>
                <option value="">Selectionner</option>
                {managerOptions.map((employee) => (
                  <option key={employee.user.id} value={employee.user.id}>
                    {employee.user.firstName} {employee.user.lastName}
                  </option>
                ))}
              </SelectField>
              {f('address',     'Adresse')}
              {f('city',        'Ville')}
              {f('country',     'Pays (ISO)',         'text', 'MA')}
              <DateField label="Date de début"   value={form.startDate}       onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
              <DateField label="Fin prévue"      value={form.plannedEndDate}  onChange={(e) => setForm((p) => ({ ...p, plannedEndDate: e.target.value }))} />
              <FormField
                label="Avancement (%)"
                type="number"
                min={0}
                max={100}
                value={form.progressPercent}
                onChange={(e) => setForm((p) => ({ ...p, progressPercent: Number(e.target.value) }))}
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-mutedText">Géolocalisation GPS (optionnel)</p>
            <div className="grid gap-3 md:grid-cols-3">
              {f('latitude',        'Latitude',            'text', '33.5731')}
              {f('longitude',       'Longitude',           'text', '-7.5898')}
              {f('gpsRadiusMeters', 'Rayon de tolérance (m)', 'number')}
            </div>
            {error && <p className="text-sm text-dangerText">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Création…' : 'Créer le chantier'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data, refresh } = useApiData<Site[]>(() => api.sites() as Promise<Site[]>, demoSites);

  const myRole  = tokenStore.session?.role ?? '';
  const canEdit = myRole === 'RESOURCE_MANAGER';

  const filtered = data.filter((s) => {
    const q = search.toLowerCase();
    if (q && !`${s.name} ${s.code} ${s.city}`.toLowerCase().includes(q)) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  const columns: ColumnDef<Site, unknown>[] = [
    { header: 'Code',               accessorKey: 'code' },
    { header: 'Nom du chantier',    accessorKey: 'name' },
    { header: 'Projet',             cell: ({ row }) => row.original.project?.name ?? '-' },
    { header: 'Client',             accessorKey: 'clientName' },
    { header: 'Ville',              accessorKey: 'city' },
    { header: 'Responsable',        cell: ({ row }) => row.original.manager ? `${row.original.manager.firstName} ${row.original.manager.lastName}` : '—' },
    { header: 'Employés affectés',  cell: ({ row }) => row.original._count.assignments },
    { header: 'Avancement',         cell: ({ row }) => <ProgressMeter value={row.original.progressPercent} size="sm" /> },
    { header: 'Statut',             cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <Link href={`/sites/${row.original.id}`} className="text-sm font-medium text-accent hover:underline">
          Voir
        </Link>
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Chantiers"
          description={canEdit ? 'Gestion des sites, affectations, heures et anomalies GPS.' : 'Consultation des chantiers et suivi GPS.'}
          actions={canEdit ? <NewSiteModal onCreated={refresh} /> : undefined}
        />

        <div className="grid gap-3 rounded-xl border border-borderSoft bg-surface p-4 shadow-card md:grid-cols-3">
          <FormField
            label="Recherche"
            placeholder="Nom, code, ville…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SelectField label="Statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="SUSPENDED">Suspendu</option>
            <option value="COMPLETED">Terminé</option>
          </SelectField>
          <SelectField label="Ville">
            <option value="">Toutes les villes</option>
            <option>Casablanca</option>
            <option>Rabat</option>
          </SelectField>
        </div>

        <DataTable columns={columns} data={filtered} />
      </div>
    </AppShell>
  );
}
