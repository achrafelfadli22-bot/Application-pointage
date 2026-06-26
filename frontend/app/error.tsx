'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service in production.
    console.error('[Pointage360 Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-dangerBg">
        <AlertTriangle className="h-7 w-7 text-dangerText" />
      </div>

      <div className="grid gap-1.5">
        <h1 className="text-lg font-semibold text-bodyText">Une erreur s'est produite</h1>
        <p className="max-w-sm text-sm text-mutedText">
          {error.message || "Quelque chose s'est mal passe. Reessayez ou revenez plus tard."}
        </p>
        {error.digest && <p className="font-mono text-xs text-hintText">Ref : {error.digest}</p>}
      </div>

      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-md border border-borderSoft bg-surface px-4 py-2 text-sm font-medium text-bodyText shadow-card transition-colors hover:bg-surfaceHover"
      >
        <RefreshCw className="h-4 w-4" />
        Reessayer
      </button>
    </div>
  );
}
