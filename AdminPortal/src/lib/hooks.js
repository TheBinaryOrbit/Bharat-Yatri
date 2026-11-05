import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from './api.js';

// GET with loading / error / reload. `deps` re-run it; `params` changes are compared by value.
export function useApi(path, params, { enabled = true, interval = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && path));
  const key = JSON.stringify([path, params]);
  const seq = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (!enabled || !path) return;
      const id = ++seq.current;
      if (!quiet) setLoading(true);
      try {
        const d = await api.get(path, params);
        if (id === seq.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (id === seq.current) setError(e);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!interval || !enabled) return undefined;
    const t = setInterval(() => load(true), interval);
    return () => clearInterval(t);
  }, [interval, enabled, load]);

  return { data, error, loading, reload: load, setData };
}

// Filters kept in the URL so a filtered list survives refresh and can be shared.
export function useUrlFilters(defaults = {}) {
  const [sp, setSp] = useSearchParams();
  const values = { ...defaults };
  sp.forEach((v, k) => {
    values[k] = v;
  });
  const set = useCallback(
    (patch, { resetPage = true } = {}) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => {
            if (v === '' || v == null || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          });
          if (resetPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSp]
  );
  const clear = useCallback(() => setSp(new URLSearchParams(), { replace: true }), [setSp]);
  return [values, set, clear];
}

// Debounced value for search boxes.
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
