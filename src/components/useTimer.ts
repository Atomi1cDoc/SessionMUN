import { useEffect, useRef, useState } from 'react';

export interface TimerApi {
  remaining: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: (to?: number) => void;
  setRemaining: (n: number) => void;
}

/**
 * Local countdown timer. Ticks in component state (no store writes each second).
 * Callbacks let the caller persist/commit on meaningful transitions.
 */
export function useTimer(opts: {
  initialSeconds: number;
  autoStart?: boolean;
  onExpire?: () => void;
  onCommit?: (remaining: number, running: boolean) => void;
}): TimerApi {
  const { initialSeconds, autoStart = false, onExpire, onCommit } = opts;
  const [remaining, setRemainingState] = useState(initialSeconds);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemainingState((r) => {
        if (r <= 1) {
          if (!expiredRef.current) {
            expiredRef.current = true;
            // Defer to avoid setState-during-render warnings.
            setTimeout(() => {
              setRunning(false);
              onExpire?.();
            }, 0);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const commit = (rem: number, run: boolean) => onCommit?.(rem, run);

  return {
    remaining,
    running,
    start: () => {
      if (remaining <= 0) return;
      expiredRef.current = false;
      setRunning(true);
    },
    pause: () => {
      setRunning(false);
      commit(remaining, false);
    },
    toggle: () => {
      if (running) {
        setRunning(false);
        commit(remaining, false);
      } else if (remaining > 0) {
        expiredRef.current = false;
        setRunning(true);
      }
    },
    reset: (to?: number) => {
      const target = to ?? initialSeconds;
      expiredRef.current = false;
      setRunning(false);
      setRemainingState(target);
      commit(target, false);
    },
    setRemaining: (n: number) => {
      setRemainingState(n);
      commit(n, running);
    },
  };
}
