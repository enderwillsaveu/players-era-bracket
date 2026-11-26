import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_BACKOFF = 5 * 60 * 1000;

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// Polls `url` on an interval the server suggests (`pollMs` in the response, or
// `fallbackMs`), unless `intervalMs` pins a fixed rate. Stops while the tab is
// hidden or `paused`, refetches when the tab becomes visible again, and backs
// off exponentially on errors.
export function usePolling(url, { fallbackMs = 30000, paused = false, intervalOf, intervalMs = null } = {}) {
  const [state, setState] = useState({ data: null, error: null, updatedAt: null, loading: Boolean(url) });
  const [nextAt, setNextAt] = useState(null);
  const [delayMs, setDelayMs] = useState(null);
  const timer = useRef(null);
  const failures = useRef(0);
  const suggested = useRef(fallbackMs);
  const inflight = useRef(false);
  const override = useRef(intervalMs);
  override.current = intervalMs;
  const currentInterval = () => override.current || suggested.current;

  const load = useCallback(async () => {
    if (!url || inflight.current) return;
    inflight.current = true;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await getJson(url);
      failures.current = 0;
      suggested.current = (intervalOf && intervalOf(data)) || data.pollMs || fallbackMs;
      setState({ data, error: null, updatedAt: Date.now(), loading: false });
    } catch (err) {
      failures.current += 1;
      setState((s) => ({ ...s, error: err.message, loading: false }));
    } finally {
      inflight.current = false;
    }
  }, [url, fallbackMs, intervalOf]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    if (!url || paused || document.hidden) {
      setNextAt(null);
      return;
    }
    const base = currentInterval();
    const delay = failures.current ? Math.min(base * 2 ** failures.current, MAX_BACKOFF) : base;
    setNextAt(Date.now() + delay);
    setDelayMs(delay);
    timer.current = setTimeout(async () => {
      await load();
      schedule();
    }, delay);
  }, [url, paused, load]);

  const refresh = useCallback(async () => {
    clearTimeout(timer.current);
    await load();
    schedule();
  }, [load, schedule]);

  useEffect(() => {
    setState({ data: null, error: null, updatedAt: null, loading: Boolean(url) });
    failures.current = 0;
    suggested.current = fallbackMs;
    refresh();
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Reschedule when paused/resumed or the chosen rate changes. Skip the
  // initial run: the url effect above already loaded and scheduled.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return undefined;
    }
    schedule();
    return () => clearTimeout(timer.current);
  }, [paused, intervalMs, schedule]);

  useEffect(() => {
    const onVis = () => (document.hidden ? schedule() : refresh());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh, schedule]);

  // interval: the rate in use (ignoring error backoff). delayMs: the wait
  // before the pending fetch (with backoff). suggestedMs: the server's rate.
  return { ...state, nextAt, delayMs, refresh, interval: currentInterval(), suggestedMs: suggested.current };
}

export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [key, value]);
  return [value, setValue];
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
