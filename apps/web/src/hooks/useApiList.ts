import { useCallback, useEffect, useRef, useState, type DependencyList, type Dispatch, type SetStateAction } from "react";

/**
 * Collapses the fetch-list boilerplate repeated across list pages:
 *   useState(data) + useState(loading) + a refresh() that
 *   `.then(setData).catch().finally(setLoading(false))` + a useEffect.
 *
 * `fetcher` returns the already-unwrapped list (e.g. `api.list().then(r => r.items)`).
 * `setData` is exposed so callers can still apply optimistic updates
 * (delete → filter, add → append) without a round-trip. Errors are swallowed
 * into `error` — pages that need a toast should keep their own fetch.
 *
 * Re-fetches whenever `deps` change (same semantics as the old useEffect deps).
 */
export function useApiList<T>(
  fetcher: () => Promise<T>,
  initial: T,
  deps: DependencyList = [],
): {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    setLoading(true);
    return fetcherRef.current()
      .then((res) => setData(res))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, refresh };
}
