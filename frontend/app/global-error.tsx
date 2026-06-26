'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * global-error.tsx — catches errors in the root layout itself.
 * Must include its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Pointage360 Global Error]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center font-sans">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-600" />
        </div>

        <div className="grid gap-1.5">
          <h1 className="text-lg font-semibold text-gray-800">Erreur critique</h1>
          <p className="max-w-sm text-sm text-gray-500">
            L'application a rencontré une erreur inattendue.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 font-mono">Ref : {error.digest}</p>
          )}
        </div>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      </body>
    </html>
  );
}
