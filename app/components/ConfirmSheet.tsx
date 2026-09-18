"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// The one confirm pattern for anything destructive or hard to undo: a sheet
// from the bottom on a phone, a centred card on desktop. Replaces the
// browser's native confirm(), which looks foreign inside a home-screen app.

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/** `const confirm = useConfirm(); if (!(await confirm({ title: "Remove Maria?" }))) return;` */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setPending({ opts, resolve })),
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      setPending((p) => {
        p?.resolve(value);
        return null;
      });
    },
    [],
  );

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) close(false);
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              className="w-full max-w-sm rounded-modal border border-line-strong bg-surface-2 p-6 shadow-e3"
            >
              <h2 id="confirm-title" className="font-display text-lg font-bold text-ink-primary">
                {pending.opts.title}
              </h2>
              {pending.opts.body && (
                <p className="mt-2 text-sm text-ink-secondary">{pending.opts.body}</p>
              )}
              <div className="mt-5 flex gap-2 sm:justify-end">
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(false)}
                  className="min-h-11 flex-1 rounded-control border border-line-strong bg-surface-3 px-4 py-2 font-display text-sm font-bold text-ink-primary transition hover:border-red sm:flex-none"
                >
                  {pending.opts.cancelLabel ?? "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`min-h-11 flex-1 rounded-control px-4 py-2 font-display text-sm font-bold transition sm:flex-none ${
                    pending.opts.danger
                      ? "bg-red text-bone hover:bg-red-hover"
                      : "bg-red text-bone hover:bg-red-hover"
                  }`}
                >
                  {pending.opts.confirmLabel ?? "Confirm"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}
