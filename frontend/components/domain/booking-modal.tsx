'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Paperclip, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PrimaryButton, SecondaryButton } from '../ui/buttons';
import { DateField, FormField, SelectField } from '../ui/form-fields';

type LeaveType = { id: string; name: string; annualAllowanceDays: number };
type Balance = { leaveType: { name: string }; remainingDays: number | string; pendingDays: number | string; year: number };

export function BookingModal() {
  const [open, setOpen] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    startHalfDay: false,
    endHalfDay: false,
    comment: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      api.leaveTypes()
        .then((data) => {
          const types = data as LeaveType[];
          setLeaveTypes(types);
          const firstType = types[0];
          if (firstType) setForm((p) => ({ ...p, leaveTypeId: firstType.id }));
          if (!firstType) setError('Aucun type de congé actif n’est disponible.');
        })
        .catch(() => setError('Impossible de charger les types de congé.'));

      const currentYear = new Date().getFullYear();
      api.leaveBalances()
        .then((data) => {
          // Garder uniquement l'année courante (ou la plus récente par type)
          const raw = data as Balance[];
          const deduped = Object.values(
            raw.reduce<Record<string, Balance>>((acc, b) => {
              const key = b.leaveType.name;
              if (!acc[key] || b.year > acc[key]!.year) acc[key] = b;
              return acc;
            }, {}),
          ).filter((b) => b.year === currentYear || b.year === currentYear - 1);
          setBalances(deduped);
        })
        .catch(() => {});
    }
  }, [open]);

  async function handleSubmit() {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) {
      setError('Type de congé, date de début et date de fin sont requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1. Créer la demande
      const created = await api.createLeaveRequest(form as Record<string, unknown>) as { id: string };

      // 2. Uploader le justificatif si présent
      if (file && created?.id) {
        try {
          await api.uploadLeaveAttachment(created.id, file);
        } catch (uploadError) {
          throw new Error(
            uploadError instanceof Error
              ? `Le justificatif n'a pas été sauvegardé : ${uploadError.message}`
              : "Le justificatif n'a pas été sauvegardé.",
          );
          // L'upload est optionnel — ne pas bloquer la soumission
        }
      }

      // 3. Soumettre automatiquement
      if (created?.id) {
        await api.submitLeaveRequest(created.id);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({ leaveTypeId: '', startDate: '', endDate: '', startHalfDay: false, endHalfDay: false, comment: '' });
    setFile(null);
    setError(null);
    setSuccess(false);
  }

  const displayTypes = leaveTypes;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <Dialog.Trigger asChild>
        <PrimaryButton type="button">Demander un congé</PrimaryButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-borderSoft bg-surface shadow-dropdown">
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Demander un congé</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText transition-colors hover:bg-surfaceHover hover:text-bodyText">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {success ? (
            <div className="p-10 text-center">
              <div className="text-3xl text-successText">✓</div>
              <p className="mt-3 text-lg font-semibold text-bodyText">Demande soumise avec succès !</p>
            </div>
          ) : (
            <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-4">
                <SelectField
                  label="Type de congé"
                  value={form.leaveTypeId}
                  onChange={(e) => setForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
                >
                  <option value="">Sélectionner un type de congé</option>
                  {displayTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </SelectField>

                <div className="grid gap-4 md:grid-cols-2">
                  <DateField
                    label="Date de début"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                  <DateField
                    label="Date de fin"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-bodyText">Demi-journée début</span>
                    <select
                      value={form.startHalfDay ? 'true' : 'false'}
                      onChange={(e) => setForm((p) => ({ ...p, startHalfDay: e.target.value === 'true' }))}
                      className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
                    >
                      <option value="false">Journée entière</option>
                      <option value="true">Demi-journée</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-bodyText">Demi-journée fin</span>
                    <select
                      value={form.endHalfDay ? 'true' : 'false'}
                      onChange={(e) => setForm((p) => ({ ...p, endHalfDay: e.target.value === 'true' }))}
                      className="h-10 rounded-md border border-borderSoft bg-white px-3 text-sm outline-none focus:border-accent"
                    >
                      <option value="false">Journée entière</option>
                      <option value="true">Demi-journée</option>
                    </select>
                  </label>
                </div>

                <FormField
                  label="Commentaire (optionnel)"
                  placeholder="Précision sur la demande..."
                  value={form.comment}
                  onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                />

                {/* Justificatif upload */}
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-bodyText">Justificatif (PDF, JPEG, PNG — optionnel)</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-10 items-center gap-2 rounded-md border border-dashed border-borderSoft bg-surfaceHover px-3 text-sm text-mutedText hover:border-accent hover:text-accentText"
                  >
                    <Paperclip className="h-4 w-4" />
                    {file ? file.name : 'Joindre un fichier…'}
                  </button>
                  {file && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-left text-xs text-dangerText hover:underline"
                    >
                      Supprimer le fichier
                    </button>
                  )}
                </div>

                {error && (
                  <div className="border border-dangerBorder bg-dangerBg p-3 text-sm text-dangerText">{error}</div>
                )}
              </div>

              <aside className="rounded-lg border border-borderSoft bg-surfaceHover p-4">
                {(() => {
                  // Durée en jours ouvrés
                  let duration = 0;
                  let durationLabel = '—';
                  if (form.startDate && form.endDate) {
                    const start = new Date(form.startDate);
                    const end   = new Date(form.endDate);
                    if (end >= start) {
                      const cur = new Date(start);
                      while (cur <= end) {
                        const d = cur.getUTCDay();
                        if (d !== 0 && d !== 6) duration++;
                        cur.setUTCDate(cur.getUTCDate() + 1);
                      }
                      if (form.startHalfDay) duration -= 0.5;
                      if (form.endHalfDay)   duration -= 0.5;
                      durationLabel = duration > 0 ? `${duration} jour${duration > 1 ? 's' : ''}` : 'Vérifier les dates';
                    } else {
                      durationLabel = 'Date invalide';
                    }
                  }

                  // Solde pour le type sélectionné
                  const selectedType = displayTypes.find((t) => t.id === form.leaveTypeId);
                  const balance = balances.find((b) => b.leaveType.name === selectedType?.name);
                  const remaining = balance ? Number(balance.remainingDays) : null;
                  const pending   = balance ? Number(balance.pendingDays)   : 0;
                  const afterRequest = remaining !== null ? remaining - duration : null;
                  const soldeColor = afterRequest !== null && afterRequest < 0
                    ? 'text-dangerText'
                    : afterRequest !== null && afterRequest <= 2
                    ? 'text-amber-600'
                    : 'text-successText';

                  return (
                    <>
                      {/* Bloc solde */}
                      {remaining !== null && (
                        <div className="mb-4 rounded-lg border border-borderSoft bg-surface p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-mutedText mb-2">Solde — {selectedType?.name}</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold text-bodyText">{remaining}</p>
                              <p className="text-[10px] text-mutedText">Disponible</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-amber-600">{pending}</p>
                              <p className="text-[10px] text-mutedText">En attente</p>
                            </div>
                            <div>
                              <p className={`text-lg font-bold ${soldeColor}`}>
                                {afterRequest !== null && duration > 0 ? afterRequest : '—'}
                              </p>
                              <p className="text-[10px] text-mutedText">Après demande</p>
                            </div>
                          </div>
                          {afterRequest !== null && afterRequest < 0 && (
                            <p className="mt-2 text-xs text-dangerText">⚠ Solde insuffisant pour cette demande.</p>
                          )}
                        </div>
                      )}

                      {/* Récap */}
                      {[
                        ['Cette demande', durationLabel],
                        ['Approbateurs', 'Chef de projet · Resource Manager'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between border-b border-borderSoft py-3 text-sm last:border-0">
                          <span className="text-mutedText">{label}</span>
                          <span className="font-semibold text-bodyText">{value}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
                <div className="mt-5 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <SecondaryButton type="button">Annuler</SecondaryButton>
                  </Dialog.Close>
                  <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Envoi…' : 'Soumettre'}
                  </PrimaryButton>
                </div>
              </aside>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
