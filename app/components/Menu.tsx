"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// A small dropdown for the actions a row doesn't need on show all the time.
// Closes on outside tap or Escape. Items are buttons, or links when given
// an href (sms:, mailto:).

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
}

export default function Menu({
  label,
  ariaLabel,
  items,
  className,
  align = "right",
}: {
  label: ReactNode;
  ariaLabel: string;
  items: MenuItem[];
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemCls = (danger?: boolean) =>
    `block w-full min-h-9 rounded-control px-3 py-2 text-left text-sm font-medium transition ${
      danger
        ? "text-state-bad hover:bg-red-subtle"
        : "text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={
          className ??
          "min-h-9 rounded-control border border-line-strong bg-surface-3 px-3 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary"
        }
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-30 mt-1 min-w-[11rem] rounded-card border border-line bg-surface-4 p-1 shadow-e2 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((it) =>
            it.href ? (
              <a
                key={it.label}
                role="menuitem"
                href={it.href}
                onClick={() => setOpen(false)}
                className={itemCls(it.danger)}
              >
                {it.label}
              </a>
            ) : (
              <button
                key={it.label}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  it.onSelect?.();
                }}
                className={itemCls(it.danger)}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
