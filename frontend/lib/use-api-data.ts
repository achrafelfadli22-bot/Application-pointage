'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type FallbackMode = 'development' | 'always' | 'never';

type UseApiDataOptions = {
  fallbackMode?: FallbackMode;
};

function canUseFallback(mode: FallbackMode) {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS === 'true';
}

function neutralData<T>(value: T): T {
  if (Array.isArray(value)) return [] as T;
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return 0 as T;
  if (typeof value === 'string') return '' as T;
  if (typeof value === 'boolean') return false as T;
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, neutralData(entry)]),
    ) as T;
  }
  return value;
}

export function useApiData<T>(loader: () => Promise<T>, fallback: T, options: UseApiDataOptions = {}) {
  const fallbackMode = options.fallbackMode ?? 'development';
  const fallbackAllowed = canUseFallback(fallbackMode);
  const fallbackRef = useRef(fallback);
  const fallbackAllowedRef = useRef(fallbackAllowed);
  const hasResolvedDataRef = useRef(false);
  const [data, setData] = useState<T>(() => (fallbackAllowed ? fallback : neutralData(fallback)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);

  useEffect(() => {
    fallbackRef.current = fallback;
    fallbackAllowedRef.current = fallbackAllowed;
  }, [fallback, fallbackAllowed]);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loaderRef
      .current()
      .then((value) => {
        if (!cancelled) {
          hasResolvedDataRef.current = true;
          setData(value);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur API');
          if (!hasResolvedDataRef.current) {
            const currentFallback = fallbackRef.current;
            setData(fallbackAllowedRef.current ? currentFallback : neutralData(currentFallback));
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refresh, isFallback: !hasResolvedDataRef.current && fallbackAllowed };
}
