'use client';

import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Upload, X, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/buttons';
import { api } from '@/lib/api-client';

// ─── CSV Template ─────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'firstName', 'lastName', 'email', 'phone', 'employeeNumber',
  'jobTitle', 'role', 'contractType', 'hireDate',
  'annualLeaveBalance', 'hourlyRate', 'password',
];

const CSV_TEMPLATE = [
  CSV_HEADERS.join(','),
  'Omar,Mansouri,omar.mansouri@example.com,+212600000001,EMP-001,Maçon,EMPLOYEE,CDI,2024-01-15,18,85,Password123!',
  'Fatima,Zahraoui,fatima.zahraoui@example.com,+212600000002,EMP-002,Electricien,EMPLOYEE,CDD,2024-03-01,18,90,Password123!',
].join('\n');

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'modele-import-employes.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

type RowData = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: RowData[] } {
  const lines   = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows    = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: RowData = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });

  return { headers, rows };
}

function validateRow(row: RowData): string[] {
  const errors: string[] = [];
  if (!row.firstName)      errors.push('Prénom manquant');
  if (!row.lastName)       errors.push('Nom manquant');
  if (!row.email || !row.email.includes('@')) errors.push('Email invalide');
  if (!row.employeeNumber) errors.push('Matricule manquant');
  if (!row.hireDate)       errors.push('Date d\'embauche manquante');
  return errors;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ImportResult = { row: RowData; success: boolean; error?: string };

interface CsvImportModalProps {
  onImported: () => void;
}

export function CsvImportModal({ onImported }: CsvImportModalProps) {
  const [open, setOpen]       = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows]       = useState<RowData[]>([]);
  const [errors, setErrors]   = useState<Record<number, string[]>>({});
  const [importing, setImporting] = useState(false);
  const [results, setResults]     = useState<ImportResult[] | null>(null);
  const [dragOver, setDragOver]   = useState(false);

  function reset() {
    setHeaders([]);
    setRows([]);
    setErrors({});
    setResults(null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      setHeaders(h);
      setRows(r);
      // Validate
      const errs: Record<number, string[]> = {};
      r.forEach((row, i) => {
        const e = validateRow(row);
        if (e.length) errs[i] = e;
      });
      setErrors(errs);
      setResults(null);
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  const validRows   = rows.filter((_, i) => !errors[i]);
  const invalidRows = rows.filter((_, i) => !!errors[i]);

  async function handleImport() {
    if (!validRows.length) return;
    setImporting(true);
    const res: ImportResult[] = [];
    for (const row of validRows) {
      try {
        await api.createEmployee({
          ...row,
          annualLeaveBalance: Number(row.annualLeaveBalance) || 18,
          hourlyRate:         Number(row.hourlyRate)         || 0,
          password:           row.password || 'Password123!',
        });
        res.push({ row, success: true });
      } catch (e) {
        res.push({ row, success: false, error: e instanceof Error ? e.message : 'Erreur' });
      }
    }
    setResults(res);
    setImporting(false);
    const hasSuccess = res.some((r) => r.success);
    if (hasSuccess) onImported();
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount    = results?.filter((r) => !r.success).length ?? 0;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-lg border border-borderSoft bg-surface px-3 text-sm font-medium text-bodyText shadow-card transition-colors hover:bg-surfaceHover"
        >
          <Upload className="h-4 w-4 text-mutedText" />
          Importer CSV
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(720px,calc(100vw-32px))] max-h-[90vh] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-borderSoft bg-surface shadow-dropdown">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-borderSoft px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-bodyText">Import d'employés — CSV</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-mutedText hover:bg-surfaceHover">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="grid gap-4 p-5">

            {/* Template download */}
            <div className="flex items-center justify-between rounded-lg border border-borderSoft bg-grayCard px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-bodyText">Modèle CSV</p>
                <p className="text-xs text-mutedText">Téléchargez et remplissez le fichier modèle avant d'importer.</p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 rounded-lg border border-borderSoft bg-surface px-3 py-1.5 text-xs font-medium text-bodyText hover:bg-accentLight hover:text-accentText hover:border-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger le modèle
              </button>
            </div>

            {/* Drop zone */}
            {!rows.length && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                  dragOver ? 'border-accent bg-accentLight/40' : 'border-borderSoft hover:border-accent hover:bg-accentLight/20'
                }`}
              >
                <FileText className="h-10 w-10 text-mutedText" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-bodyText">Glissez votre fichier CSV ici</p>
                  <p className="text-xs text-mutedText">ou cliquez pour parcourir</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </div>
            )}

            {/* Résultats import */}
            {results && (
              <div className="grid gap-2">
                <div className="flex items-center gap-3 rounded-lg border border-successBorder bg-successBg px-4 py-3 text-sm text-successText">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span><strong>{successCount}</strong> employé{successCount > 1 ? 's' : ''} importé{successCount > 1 ? 's' : ''} avec succès.</span>
                </div>
                {failCount > 0 && (
                  <div className="rounded-lg border border-dangerBorder bg-dangerBg px-4 py-3 text-sm text-dangerText">
                    <AlertCircle className="mr-2 inline h-4 w-4" />
                    <strong>{failCount}</strong> échec{failCount > 1 ? 's' : ''}.
                    <ul className="mt-1 list-inside list-disc text-xs">
                      {results.filter((r) => !r.success).map((r, i) => (
                        <li key={i}>{r.row.email || r.row.firstName} — {r.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Aperçu et validation */}
            {rows.length > 0 && !results && (
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-bodyText">
                    {rows.length} ligne{rows.length > 1 ? 's' : ''} détectée{rows.length > 1 ? 's' : ''}
                    {invalidRows.length > 0 && (
                      <span className="ml-2 text-dangerText">· {invalidRows.length} avec erreur{invalidRows.length > 1 ? 's' : ''}</span>
                    )}
                  </p>
                  <button type="button" onClick={reset} className="text-xs text-mutedText hover:text-bodyText underline">
                    Changer de fichier
                  </button>
                </div>

                {/* Colonnes requises manquantes */}
                {(() => {
                  const required = ['firstName', 'lastName', 'email', 'employeeNumber', 'hireDate'];
                  const missing  = required.filter((k) => !headers.includes(k));
                  return missing.length ? (
                    <div className="rounded-lg border border-dangerBorder bg-dangerBg px-3 py-2 text-xs text-dangerText">
                      Colonnes manquantes : <strong>{missing.join(', ')}</strong>
                    </div>
                  ) : null;
                })()}

                {/* Tableau aperçu */}
                <div className="overflow-x-auto rounded-lg border border-borderSoft">
                  <table className="w-full text-xs">
                    <thead className="border-b border-borderSoft bg-grayCard">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-mutedText">#</th>
                        {['firstName', 'lastName', 'email', 'employeeNumber', 'jobTitle', 'contractType'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-mutedText">{h}</th>
                        ))}
                        <th className="px-3 py-2 text-left font-semibold text-mutedText">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borderSoft">
                      {rows.slice(0, 8).map((row, i) => {
                        const rowErrors = errors[i];
                        return (
                          <tr key={i} className={rowErrors ? 'bg-red-50' : 'hover:bg-surfaceHover'}>
                            <td className="px-3 py-2 text-mutedText">{i + 1}</td>
                            {['firstName', 'lastName', 'email', 'employeeNumber', 'jobTitle', 'contractType'].map((h) => (
                              <td key={h} className="px-3 py-2 text-bodyText">{row[h] || '—'}</td>
                            ))}
                            <td className="px-3 py-2">
                              {rowErrors ? (
                                <span className="text-dangerText">⚠ {rowErrors[0]}</span>
                              ) : (
                                <span className="text-green-600">✓ OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {rows.length > 8 && (
                    <div className="border-t border-borderSoft px-3 py-2 text-xs text-mutedText">
                      + {rows.length - 8} ligne{rows.length - 8 > 1 ? 's' : ''} supplémentaire{rows.length - 8 > 1 ? 's' : ''}…
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-mutedText">
                    <span className="font-semibold text-successText">{validRows.length} valide{validRows.length > 1 ? 's' : ''}</span>
                    {invalidRows.length > 0 && (
                      <span className="ml-2 text-dangerText">{invalidRows.length} ignorée{invalidRows.length > 1 ? 's' : ''}</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <SecondaryButton type="button" onClick={reset}>Annuler</SecondaryButton>
                    <PrimaryButton
                      type="button"
                      onClick={handleImport}
                      disabled={importing || !validRows.length}
                    >
                      {importing ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Import en cours…</>
                      ) : (
                        <><Upload className="h-4 w-4" /> Importer {validRows.length} employé{validRows.length > 1 ? 's' : ''}</>
                      )}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}

            {/* Close button after results */}
            {results && (
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <PrimaryButton type="button">Fermer</PrimaryButton>
                </Dialog.Close>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
