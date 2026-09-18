"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  REASONS_BY_CATEGORY,
  REASON_LABELS,
  linenLabel,
} from "@/lib/constants";
import type {
  Category,
  CentralReserveItem,
  PullReason,
  Unit,
} from "@/lib/types";

interface Options {
  units: Pick<Unit, "unit_id" | "name">[];
  items: Pick<CentralReserveItem, "item_name" | "category" | "quantity_on_hand">[];
  viewer_name?: string;
}

export interface PullPrefill {
  item_name?: string;
  category?: Category;
  unit_id?: string;
  reason?: PullReason;
  quantity?: number;
}

const STAFF_KEY = "mason_inv_staff";

/**
 * The "log a pull from the Stockroom" modal. Controlled: the caller owns
 * `open`. It renders through a portal onto <body>, because the sticky header
 * has a backdrop blur, and a blurred ancestor becomes the containing block for
 * anything position:fixed inside it — the modal was centring itself on the
 * 56px bar and clipping off the top of the screen.
 */
export function PullModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: PullPrefill;
}) {
  const router = useRouter();
  const [opts, setOpts] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [staff, setStaff] = useState("");
  const [itemKey, setItemKey] = useState(""); // "category::item_name"
  const [qty, setQty] = useState("1");
  const [unitId, setUnitId] = useState("");
  const [reason, setReason] = useState<PullReason>("weekly_restock");

  // Fresh form each time it opens: seed from the roster/reserve and prefill.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOpts(null);
    setError("");
    setBusy(false);
    setQty(prefill?.quantity ? String(prefill.quantity) : "1");
    setStaff(localStorage.getItem(STAFF_KEY) ?? "");
    (async () => {
      try {
        const res = await fetch("/api/pull");
        if (!res.ok) throw new Error("Could not load Stockroom items.");
        const data: Options = await res.json();
        if (cancelled) return;
        setOpts(data);
        // Who's pulling defaults to the logged-in user; the last typed name is
        // only a fallback for off-roster sessions.
        if (data.viewer_name) setStaff(data.viewer_name);
        const seedItem =
          prefill?.item_name && prefill.category
            ? `${prefill.category}::${prefill.item_name}`
            : data.items[0]
              ? `${data.items[0].category}::${data.items[0].item_name}`
              : "";
        setItemKey(seedItem);
        setUnitId(prefill?.unit_id ?? data.units[0]?.unit_id ?? "");
        const cat = (seedItem.split("::")[0] as Category) || "consumable";
        setReason(prefill?.reason ?? REASONS_BY_CATEGORY[cat][0]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the reason valid for the selected item's category.
  const category = (itemKey.split("::")[0] as Category) || "consumable";
  useEffect(() => {
    if (!itemKey) return;
    const allowed = REASONS_BY_CATEGORY[category];
    if (!allowed.includes(reason)) setReason(allowed[0]);
  }, [itemKey, category, reason]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [cat, item] = itemKey.split("::");
    const quantity = parseInt(qty, 10);
    if (!staff.trim() || !item || !unitId || !quantity || quantity < 1) {
      setError("Fill in staff, item, quantity, and destination.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      localStorage.setItem(STAFF_KEY, staff.trim());
      const res = await fetch("/api/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_name: staff.trim(),
          item_name: item,
          category: cat,
          quantity,
          destination_unit_id: unitId,
          reason,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not log the pull.");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const field =
    "mt-1 w-full rounded-control border border-line-strong bg-surface-3 px-3 py-2.5 text-sm text-ink-primary outline-none focus:border-red";
  const labelCls =
    "text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Log a pull from the Stockroom"
        className="w-full max-w-md rounded-modal border border-line-strong bg-surface-2 p-6 shadow-e3"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-primary">
            Log a pull from the Stockroom
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-control px-2 py-1 text-ink-tertiary hover:text-ink-primary"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Draws down the Stockroom and resets the unit&apos;s item to par.
        </p>

        {!opts ? (
          error ? (
            <p className="mt-6 text-sm text-state-bad" role="alert">
              {error}
            </p>
          ) : (
            <p className="mt-6 text-sm text-ink-tertiary">Loading…</p>
          )
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className={labelCls}>Your name</label>
              <input
                value={staff}
                onChange={(e) => setStaff(e.target.value)}
                placeholder="Who's pulling"
                className={field}
                autoFocus={!staff}
              />
            </div>

            <div>
              <label className={labelCls}>Item</label>
              <select
                value={itemKey}
                onChange={(e) => setItemKey(e.target.value)}
                className={field}
              >
                <optgroup label="Consumables">
                  {opts.items
                    .filter((i) => i.category === "consumable")
                    .map((i) => (
                      <option
                        key={`consumable::${i.item_name}`}
                        value={`consumable::${i.item_name}`}
                      >
                        {i.item_name} ({i.quantity_on_hand} left)
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Linens">
                  {opts.items
                    .filter((i) => i.category === "linen")
                    .map((i) => (
                      <option
                        key={`linen::${i.item_name}`}
                        value={`linen::${i.item_name}`}
                      >
                        {linenLabel(i.item_name)} ({i.quantity_on_hand} left)
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="flex gap-3">
              <div className="w-24">
                <label className={labelCls}>Qty</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={`${field} tnum`}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Destination</label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className={field}
                >
                  {opts.units.map((u) => (
                    <option key={u.unit_id} value={u.unit_id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as PullReason)}
                className={field}
              >
                {REASONS_BY_CATEGORY[category].map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-state-bad" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-control bg-red px-3 py-2.5 font-display text-sm font-bold text-bone transition duration-150 ease-out hover:bg-red-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Logging…" : "Log pull"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Button styles shared by every "log a pull" trigger. */
export const PULL_TRIGGER = {
  primary:
    "rounded-control bg-red px-4 py-2 font-display text-sm font-bold text-bone transition duration-150 ease-out hover:bg-red-hover active:brightness-95",
  ghost:
    "rounded-control border border-line-strong bg-surface-3 px-4 py-2 font-display text-sm font-bold text-ink-primary transition duration-150 ease-out hover:border-red hover:text-ink-primary",
  small:
    "rounded-control border border-line-strong bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-secondary transition duration-150 ease-out hover:border-red hover:text-ink-primary",
} as const;

/**
 * Self-contained trigger + modal, for places with one obvious pull to log:
 * a unit page (prefilled to that unit) or a short linen (prefilled to replace
 * it). The nav owns its own PullModal so its trigger can live inside a menu
 * that unmounts.
 */
export default function PullDialog({
  label = "Log pull",
  variant = "primary",
  prefill,
}: {
  label?: string;
  variant?: keyof typeof PULL_TRIGGER;
  prefill?: PullPrefill;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={PULL_TRIGGER[variant]}>
        {label}
      </button>
      <PullModal open={open} onClose={() => setOpen(false)} prefill={prefill} />
    </>
  );
}
