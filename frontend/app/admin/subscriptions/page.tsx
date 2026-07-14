'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { DataTable } from '@/components/ui/data-table';
import { FormField } from '@/components/ui/form-fields';
import { api } from '@/lib/api-client';
import { useApiData } from '@/lib/use-api-data';

const fallback = [
  { id: 'trial',      name: 'Essai',      maxUsers: 25,   maxSites: 5,    priceMonthly: '0.00',   features: [],   _count: { tenants: 1 } },
  { id: 'pro',        name: 'Pro',        maxUsers: 250,  maxSites: 50,   priceMonthly: '149.00', features: [],   _count: { tenants: 1 } },
  { id: 'enterprise', name: 'Entreprise', maxUsers: 5000, maxSites: 1000, priceMonthly: '499.00', features: [],   _count: { tenants: 0 } },
];

type Plan = (typeof fallback)[number];

const emptyForm = { name: '', maxUsers: '', maxSites: '', priceMonthly: '', features: '' };

// ─── Modal Nouveau / Édition plan ────────────────────────────────────────────

function PlanModal({
  plan,
  onSaved,
  trigger,
}: {
  plan?: Plan;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(
    plan
      ? {
          name: plan.name,
          maxUsers: String(plan.maxUsers),
          maxSites: String(plan.maxSites),
          priceMonthly: String(plan.priceMonthly),
          features: Array.isArray(plan.features) ? plan.features.join(', ') : '',
        }
      : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof typeof emptyForm, label: string, type = 'text', placeholder?: string) {
    return (
      <FormField label={label}>
        <input
          type={type}
          value={form[key]}
          placeholder={placeholder}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="h-9 w-full rounded-md border border-borderSoft bg-surface px-3 text-sm text-bodyText placeholder:text-hintText outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </FormField>
    );
  }

  async function handleSubmit() {
    if (!form.name || !form.maxUsers || !form.maxSites || !form.priceMonthly) {
      setError('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        maxUsers: parseInt(form.maxUsers, 10),
        maxSites: parseInt(form.maxSites, 10),
        priceMonthly: parseFloat(form.priceMonthly),
        features: form.features
          ? form.features.split(',').map((f) => f.trim()).filter(Boolean)
          : [],
      };
      if (plan) {
        await api.updateSubscriptionPlan(plan.id, payload);
      } else {
        await api.createSubscriptionPlan(payload);
      }
      setOpen(false);
      setForm(emptyForm);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setError(null); } }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">
              {plan ? 'Modifier le plan' : 'Nouveau plan tarifaire'}
            </Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover hover:text-bodyText">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {field('name', 'Nom du plan *', 'text', 'ex: Pro')}
              {field('priceMonthly', 'Prix mensuel (MAD) *', 'number', 'ex: 149')}
              {field('maxUsers', 'Utilisateurs max *', 'number', 'ex: 250')}
              {field('maxSites', 'Sites max *', 'number', 'ex: 50')}
            </div>
            {field('features', 'Fonctionnalités (séparées par virgule)', 'text', 'ex: GPS, Rapports, Export paie')}
            {error && <p className="text-sm text-dangerText">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <SecondaryButton type="button">Annuler</SecondaryButton>
              </Dialog.Close>
              <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Enregistrement…' : plan ? 'Enregistrer' : 'Créer le plan'}
              </PrimaryButton>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSubscriptionsPage() {
  const { data, refresh } = useApiData<Plan[]>(() => api.subscriptions() as Promise<Plan[]>, fallback);

  const columns: ColumnDef<Plan, unknown>[] = [
    { header: 'Plan',             accessorKey: 'name' },
    { header: 'Utilisateurs max', accessorKey: 'maxUsers' },
    { header: 'Sites max',    accessorKey: 'maxSites' },
    { header: 'Prix mensuel',     cell: ({ row }) => `${row.original.priceMonthly} MAD` },
    { header: 'Sociétés',         cell: ({ row }) => row.original._count.tenants },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <PlanModal
          plan={row.original}
          onSaved={refresh}
          trigger={
            <button
              type="button"
              title="Modifier"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-mutedText hover:bg-surfaceHover hover:text-bodyText"
            >
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
          }
        />
      ),
    },
  ];

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeader
          title="Administration — Abonnements"
          description="Plans tarifaires et limites par tenant."
          actions={
            <PlanModal
              onSaved={refresh}
              trigger={
                <PrimaryButton type="button">
                  <Plus className="h-4 w-4" />
                  Nouveau plan
                </PrimaryButton>
              }
            />
          }
        />
        <DataTable columns={columns} data={data} />
      </div>
    </AppShell>
  );
}
