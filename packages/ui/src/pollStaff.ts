export const STAFF_ACCESS_CHANGED = 'pramod:staff-access-changed';

// One request at a time. Pause hidden tabs and refresh promptly on return or review.
export function pollStaff(load: (signal: AbortSignal) => Promise<void>, interval = 5000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: AbortController | undefined;
  let stopped = false;
  const refresh = () => {
    clearTimeout(timer);
    current?.abort();
    if (stopped || document.visibilityState === 'hidden') return;
    const controller = new AbortController(); current = controller;
    void load(controller.signal).catch(() => { /* The caller displays request errors. */ }).finally(() => {
      if (!stopped && !controller.signal.aborted) timer = setTimeout(refresh, interval);
    });
  };
  window.addEventListener('focus', refresh);
  window.addEventListener(STAFF_ACCESS_CHANGED, refresh);
  document.addEventListener('visibilitychange', refresh);
  refresh();
  return () => {
    stopped = true; clearTimeout(timer); current?.abort();
    window.removeEventListener('focus', refresh);
    window.removeEventListener(STAFF_ACCESS_CHANGED, refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
