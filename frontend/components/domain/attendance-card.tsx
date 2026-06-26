'use client';

import { Clock3, LogIn, LogOut, MapPin, MapPinOff, Navigation, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { PrimaryButton, SecondaryButton } from '../ui/buttons';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FormField, SelectField } from '../ui/form-fields';

type Site = { id: string; code: string; name: string };
type TodayPunch = {
  id: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
  site?: { id: string; code: string; name: string } | null;
};

const WORK_LOCATIONS: { value: string; label: string }[] = [
  { value: 'SITE', label: 'Chantier' },
  { value: 'OFFICE', label: 'Bureau' },
  { value: 'HOME', label: 'Domicile' },
  { value: 'TRAVEL', label: 'Déplacement' },
];

type GpsState =
  | { status: 'idle' }
  | { status: 'acquiring' }
  | { status: 'ok'; lat: number; lng: number; accuracy: number }
  | { status: 'denied' }
  | { status: 'unavailable' };

/** Demande la position GPS avec un timeout de 10 s */
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unavailable')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    });
  });
}

export function AttendanceCard() {
  const [now, setNow] = useState(new Date());
  const [sites, setSites] = useState<Site[]>([]);
  // todayPunch : punch ouvert (pas encore sorti) ou dernier punch du jour (sorti, en attente de soumission)
  const [todayPunch, setTodayPunch] = useState<TodayPunch | null>(null);

  const [siteId, setSiteId] = useState('');
  const [workLocation, setWorkLocation] = useState('SITE');
  const [comment, setComment] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayLoadError, setTodayLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // GPS
  const [gps, setGps] = useState<GpsState>({ status: 'idle' });

  // Live clock
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const loadToday = useCallback(async () => {
    try {
      const punches = (await api.attendanceToday()) as TodayPunch[];
      // Punch ouvert (entré, pas sorti)
      const open = punches.find((p) => p.checkInAt && !p.checkOutAt);
      if (open) {
        setTodayLoadError(null);
        setTodayPunch(open);
        return;
      }
      // Sinon : dernier punch sorti mais pas encore soumis (DRAFT)
      const draftOut = punches.find((p) => p.checkInAt && p.checkOutAt && p.status === 'DRAFT');
      setTodayLoadError(null);
      setTodayPunch(draftOut ?? null);
    } catch (e) {
      setTodayLoadError(e instanceof Error ? e.message : 'Impossible de charger votre pointage du jour.');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await api.sites()) as Site[];
        setSites(data);
        const firstSite = data[0];
        if (firstSite) setSiteId(firstSite.id);
      } catch {
        // silently ignore
      }
    })();
    void loadToday();
  }, [loadToday]);

  // États dérivés
  const isCheckedIn   = todayPunch !== null && todayPunch.checkInAt !== null && todayPunch.checkOutAt === null;
  const isCheckedOut  = todayPunch !== null && todayPunch.checkOutAt !== null && todayPunch.status === 'DRAFT';
  const isSubmitted   = todayPunch !== null && todayPunch.status === 'SUBMITTED';
  const isApproved    = todayPunch !== null && todayPunch.status === 'APPROVED';
  const isDone        = isSubmitted || isApproved;
  const currentStep = isDone ? 4 : isCheckedOut ? 3 : isCheckedIn ? 2 : 1;
  const steps = [
    { number: 1, label: 'Pointer entree' },
    { number: 2, label: 'Pointer sortie' },
    { number: 3, label: 'Soumettre' },
  ];

  async function handleCheckIn() {
    setError(null); setSuccess(null); setLoading(true);

    // 1. Acquérir la position GPS
    let latitude: number | undefined;
    let longitude: number | undefined;
    setGps({ status: 'acquiring' });
    try {
      const pos = await getPosition();
      latitude  = pos.coords.latitude;
      longitude = pos.coords.longitude;
      setGps({ status: 'ok', lat: latitude, lng: longitude, accuracy: Math.round(pos.coords.accuracy) });
    } catch (gpsErr) {
      const err = gpsErr as GeolocationPositionError | Error;
      const isDenied = 'code' in err && err.code === 1; // PERMISSION_DENIED
      setGps({ status: isDenied ? 'denied' : 'unavailable' });
      // On continue quand même — le backend peut accepter sans GPS
    }

    // 2. Envoyer le check-in avec coordonnées si disponibles
    try {
      await api.checkIn({
        siteId: siteId || undefined,
        workLocation,
        employeeComment: comment || undefined,
        latitude,
        longitude,
      });
      setComment('');
      setSuccess('Entrée enregistrée.');
      await loadToday();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du pointage entrée.');
    } finally { setLoading(false); }
  }

  async function handleCheckOut() {
    setError(null); setSuccess(null); setLoading(true);
    try {
      await api.checkOut({ employeeComment: comment || undefined });
      setComment('');
      setSuccess('Sortie enregistrée. Pensez à soumettre votre pointage pour validation.');
      await loadToday();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du pointage sortie.');
    } finally { setLoading(false); }
  }

  async function handleSubmit() {
    if (!todayPunch) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      await api.submitAttendance(todayPunch.id);
      setSuccess('Pointage soumis pour validation.');
      await loadToday();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la soumission.');
    } finally { setLoading(false); }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-borderSoft bg-surface p-5 shadow-card">
      {/* Horloge */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-mutedText">Heure actuelle</div>
          <div className="mt-1 text-3xl font-bold text-bodyText">{now.toLocaleTimeString('fr-FR')}</div>
        </div>
        <Clock3 className="h-9 w-9 text-accent" />
      </div>

      <div className="mt-4 grid gap-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-mutedText">
          <span>Progression du pointage</span>
          <span>{isDone ? 'Termine' : `Etape ${currentStep}/3`}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {steps.map((step) => {
            const isActive = currentStep === step.number;
            const isComplete = currentStep > step.number;
            return (
              <div
                key={step.number}
                className={`rounded-md border px-2 py-2 text-center text-xs font-semibold ${
                  isComplete
                    ? 'border-successBorder bg-successBg text-successText'
                    : isActive
                    ? 'border-accent/40 bg-accentLight text-accentText'
                    : 'border-borderSoft bg-grayCard text-mutedText'
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wide">Etape {step.number}</span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Indicateur GPS */}
      {gps.status !== 'idle' && (
        <div className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium ${
          gps.status === 'ok'
            ? 'border border-successBorder bg-successBg text-successText'
            : gps.status === 'acquiring'
            ? 'border border-accent/30 bg-accentLight text-accentText'
            : 'border border-amber-200 bg-amber-50 text-amber-700'
        }`}>
          {gps.status === 'acquiring' && <><Navigation className="h-3.5 w-3.5 animate-pulse" /> Localisation en cours…</>}
          {gps.status === 'ok' && <><MapPin className="h-3.5 w-3.5" /> GPS capturé — précision ±{gps.accuracy} m</>}
          {gps.status === 'denied' && <><MapPinOff className="h-3.5 w-3.5" /> GPS refusé — pointage sans coordonnées</>}
          {gps.status === 'unavailable' && <><MapPinOff className="h-3.5 w-3.5" /> GPS indisponible — pointage sans coordonnées</>}
        </div>
      )}

      {/* Bandeau statut du jour */}
      {isCheckedIn && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-accent/30 bg-accentLight px-3 py-2 text-sm text-accentText">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            Entrée à {new Date(todayPunch!.checkInAt!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {todayPunch?.site ? ` — ${todayPunch.site.name}` : ''}
          </span>
        </div>
      )}

      {isCheckedOut && (
        <div className="mt-4 flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-800">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>
              Sorti à {new Date(todayPunch!.checkOutAt!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {todayPunch?.site ? ` — ${todayPunch.site.name}` : ''}
            </span>
          </div>
          <p className="text-xs text-amber-700">Pointage enregistré — soumettez-le pour validation.</p>
        </div>
      )}

      {isDone && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-successBorder bg-successBg px-3 py-2 text-sm text-successText">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            {isApproved ? 'Pointage approuvé' : 'Pointage soumis — en attente de validation'}
            {todayPunch?.site ? ` — ${todayPunch.site.name}` : ''}
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {/* Chantier & lieu — uniquement avant check-in */}
        {!isCheckedIn && !isCheckedOut && !isDone && (
          <SelectField label="Chantier" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">— Aucun chantier —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
            ))}
          </SelectField>
        )}

        {!isCheckedIn && !isCheckedOut && !isDone && (
          <SelectField label="Lieu de travail" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)}>
            {WORK_LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value}>{loc.label}</option>
            ))}
          </SelectField>
        )}

        {/* Commentaire — visible tant qu'on n'a pas soumis */}
        {!isDone && (
          <FormField
            label="Commentaire optionnel"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex : retard matériaux, réunion chantier…"
          />
        )}

        {/* Feedback */}
        {todayLoadError && (
          <div className="grid gap-2 rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">
            <p>Impossible de charger votre pointage du jour. Reessayez avant de pointer pour eviter un doublon.</p>
            <button
              type="button"
              onClick={() => void loadToday()}
              className="w-fit rounded-md border border-dangerBorder bg-white px-3 py-1 text-xs font-semibold text-dangerText hover:bg-dangerBg"
            >
              Reessayer
            </button>
          </div>
        )}
        {error && (
          <p className="rounded-md border border-dangerBorder bg-dangerBg px-3 py-2 text-sm text-dangerText">{error}</p>
        )}
        {success && (
          <p className="rounded-md border border-accent/30 bg-accentLight px-3 py-2 text-sm text-accentText">{success}</p>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-wrap gap-2">
          {/* Check-in */}
          {!isCheckedIn && !isCheckedOut && !isDone && (
            <PrimaryButton type="button" onClick={handleCheckIn} disabled={loading}>
              <LogIn className="h-4 w-4" />
              Pointer entrée
            </PrimaryButton>
          )}

          {/* Check-out */}
          {isCheckedIn && (
            <ConfirmDialog
              title="Confirmer la sortie"
              description="Enregistrer la sortie pour ce pointage ?"
              confirmLabel="Pointer sortie"
              onConfirm={handleCheckOut}
              trigger={
                <SecondaryButton type="button" disabled={loading}>
                  <LogOut className="h-4 w-4" />
                  Pointer sortie
                </SecondaryButton>
              }
            />
          )}

          {/* Soumettre — après checkout, tant que DRAFT */}
          {isCheckedOut && (
            <ConfirmDialog
              title="Soumettre le pointage"
              description="Envoyer ce pointage à votre gestionnaire pour validation ?"
              confirmLabel="Soumettre"
              onConfirm={handleSubmit}
              trigger={
                <PrimaryButton type="button" disabled={loading}>
                  <Send className="h-4 w-4" />
                  Soumettre pour validation
                </PrimaryButton>
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}
