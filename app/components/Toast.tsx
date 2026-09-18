"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// "It happened." One quiet line after an action, near the top so it clears
// the unit page's sticky bottom bar and stays visible with the keyboard up.
// Some carry an Undo for a few seconds (a refill, a removed linen).

export type ToastTone = "ok" | "bad" | "neutral";

interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastOptions {
  tone?: ToastTone;
  action?: ToastItem["action"];
  /** ms; defaults to 4s, or 8s when there's an action to take. */
  duration?: number;
}

const ToastContext = createContext<(text: string, opts?: ToastOptions) => void>(() => {});

/** `const toast = useToast(); toast("Riviera 105 refilled — 2 pulls logged")` */
export function useToast() {
  return useContext(ToastContext);
}

const TONE: Record<ToastTone, string> = {
  ok: "border-[rgba(31,138,76,.35)] text-ink-primary",
  bad: "border-[rgba(226,6,2,.35)] text-ink-primary",
  neutral: "border-line-strong text-ink-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((s) => s.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (text: string, opts: ToastOptions = {}) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-2), { id, text, tone: opts.tone ?? "ok", action: opts.action }]);
      const ms = opts.duration ?? (opts.action ? 8000 : 4000);
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+64px)]"
          >
            {items.map((t) => (
              <div
                key={t.id}
                role="status"
                className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card border bg-surface-4 px-4 py-3 text-sm shadow-e2 ${TONE[t.tone]}`}
              >
                <span className="min-w-0 flex-1">{t.text}</span>
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-control border border-line-strong bg-surface-3 px-2.5 py-1 font-display text-xs font-bold text-ink-primary transition hover:border-red"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded-control px-1.5 py-0.5 text-ink-tertiary hover:text-ink-primary"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
