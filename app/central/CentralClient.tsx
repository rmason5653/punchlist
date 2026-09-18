"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { linenLabel } from "@/lib/constants";
import type { Category, CentralReserveItem } from "@/lib/types";
import { Pill } from "@/app/components/ui";
import { useToast } from "@/app/components/Toast";

function displayName(item: CentralReserveItem): string {
  return item.category === "linen" ? linenLabel(item.item_name) : item.item_name;
}

export default function CentralClient({ items }: { items: CentralReserveItem[] }) {
  const groups: { key: Category; label: string }[] = [
    { key: "consumable", label: "Consumables" },
    { key: "linen", label: "Linens" },
  ];

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const rows = items.filter((i) => i.category === g.key);
        if (rows.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
              {g.label}
            </h2>
            <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
              {rows.map((item, idx) => (
                <Row key={item.id} item={item} first={idx === 0} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Row({ item, first }: { item: CentralReserveItem; first: boolean }) {
  const router = useRouter();
  const toast = useToast();
  // Consumables: "count" (on-hand only; par is calculated). Linens: "edit"
  // (on-hand + par + reorder together, since linen targets are set by hand).
  const [mode, setMode] = useState<"none" | "count" | "edit">("none");
  const [countVal, setCountVal] = useState(String(item.quantity_on_hand));
  const [parVal, setParVal] = useState(String(item.par_level));
  const [reorderVal, setReorderVal] = useState(String(item.reorder_point));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const low = item.quantity_on_hand <= item.reorder_point;
  const toPar = Math.max(0, item.par_level - item.quantity_on_hand);

  async function send(body: Record<string, number>, done: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/central/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save.");
      }
      setMode("none");
      toast(done);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startCount() {
    setMode("count");
    setCountVal(String(item.quantity_on_hand));
    setError("");
  }

  function startEdit() {
    setMode("edit");
    setCountVal(String(item.quantity_on_hand));
    setParVal(String(item.par_level));
    setReorderVal(String(item.reorder_point));
    setError("");
  }

  function bumpCount(delta: number) {
    setCountVal((v) => String(Math.max(0, (parseInt(v, 10) || 0) + delta)));
  }

  function saveCount() {
    const n = parseInt(countVal, 10);
    if (!Number.isInteger(n) || n < 0) {
      setError("Count must be zero or a positive whole number.");
      return;
    }
    void send({ count: n }, `${displayName(item)}: counted ${n}`);
  }

  // Save only the linen fields that actually changed (keeps the audit clean).
  function saveEdit() {
    const c = parseInt(countVal, 10);
    const p = parseInt(parVal, 10);
    const r = parseInt(reorderVal, 10);
    if ([c, p, r].some((n) => !Number.isInteger(n) || n < 0)) {
      setError("On hand, par, and reorder must be whole numbers.");
      return;
    }
    const body: Record<string, number> = {};
    if (c !== item.quantity_on_hand) body.count = c;
    if (p !== item.par_level) body.par_level = p;
    if (r !== item.reorder_point) body.reorder_point = r;
    if (Object.keys(body).length === 0) {
      setMode("none");
      return;
    }
    const what = [
      body.count !== undefined ? `counted ${body.count}` : null,
      body.par_level !== undefined ? `par ${body.par_level}` : null,
      body.reorder_point !== undefined ? `reorder ${body.reorder_point}` : null,
    ].filter(Boolean).join(", ");
    void send(body, `${displayName(item)}: ${what}`);
  }

  const fieldCls =
    "tnum w-20 rounded-control border border-line-strong bg-surface-3 px-2.5 py-1.5 text-sm text-ink-primary outline-none focus:border-red";
  const stepBtn =
    "h-11 w-11 shrink-0 rounded-control border border-line-strong bg-surface-3 text-lg font-bold text-ink-secondary transition hover:border-red hover:text-ink-primary active:brightness-95";
  const actionBtn =
    "rounded-control border border-line-strong bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary";
  const labelCls =
    "w-16 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary";

  return (
    <div className={first ? "" : "border-t border-line"}>
      {/* On a phone the name takes the whole first line and the numbers and
          action wrap to a second — a fixed one-line row was truncating
          "Kitchen trash bags" to "Kitchen tras…" on the one screen where the
          manager must read item names. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <div className="text-sm font-medium text-ink-primary">
            {displayName(item)}
          </div>
          <div className="tnum text-[11px] text-ink-muted">
            par {item.par_level} · reorder {item.reorder_point}
            {item.category === "consumable" && !item.fixed_par && (
              <>
                {" · "}
                <Link
                  href="/settings"
                  title="This target is calculated from leave-behind × turnovers. Change it in Settings."
                  className="text-ink-muted underline decoration-dotted underline-offset-2 transition hover:text-ink-tertiary"
                >
                  calculated
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="mr-auto w-20 text-left sm:mr-0 sm:text-right">
          <div className="tnum font-display text-2xl font-extrabold tracking-[-0.03em] text-ink-primary">
            {item.quantity_on_hand}
          </div>
          {toPar > 0 && (
            <div className="tnum text-[11px] font-semibold text-state-warn">buy {toPar}</div>
          )}
        </div>

        <div className="w-14 text-right">
          {low ? <Pill tone="warn">Low</Pill> : <Pill tone="ok">OK</Pill>}
        </div>

        <div className="flex shrink-0 gap-1.5">
          {/* Calculated consumables only take a recount (par is computed);
              linens and bulk supplies (fixed par) edit all three numbers. */}
          {item.category === "consumable" && !item.fixed_par ? (
            <button type="button" onClick={startCount} className={actionBtn}>
              Count
            </button>
          ) : (
            <button type="button" onClick={startEdit} className={actionBtn}>
              Edit
            </button>
          )}
        </div>
      </div>

      {mode === "count" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-1 px-4 py-2.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
            Counted on hand
          </label>
          <button
            type="button"
            onClick={() => bumpCount(-1)}
            aria-label="Decrease by one"
            className={stepBtn}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            value={countVal}
            onChange={(e) => setCountVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCount();
              if (e.key === "Escape") setMode("none");
            }}
            className={`${fieldCls} text-center`}
          />
          <button
            type="button"
            onClick={() => bumpCount(1)}
            aria-label="Increase by one"
            className={stepBtn}
          >
            +
          </button>
          <button
            type="button"
            onClick={saveCount}
            disabled={busy}
            className="rounded-control bg-red px-3 py-1.5 font-display text-xs font-bold text-bone transition hover:bg-red-hover active:brightness-95 disabled:opacity-50"
          >
            {busy ? "…" : "Save count"}
          </button>
          <button
            type="button"
            onClick={() => setMode("none")}
            className="px-2 py-1.5 text-xs text-ink-tertiary hover:text-ink-primary"
          >
            Cancel
          </button>
          {error && (
            <span className="text-xs text-state-bad" role="alert">
              {error}
            </span>
          )}
        </div>
      )}

      {/* Linens: count + targets in one place. */}
      {mode === "edit" && (
        <div className="space-y-2 border-t border-line bg-surface-1 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className={labelCls}>On hand</label>
            <button
              type="button"
              onClick={() => bumpCount(-1)}
              aria-label="Decrease by one"
              className={stepBtn}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={countVal}
              onChange={(e) => setCountVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setMode("none");
              }}
              className={`${fieldCls} text-center`}
            />
            <button
              type="button"
              onClick={() => bumpCount(1)}
              aria-label="Increase by one"
              className={stepBtn}
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={labelCls}>Par</label>
            <input
              type="number"
              value={parVal}
              onChange={(e) => setParVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setMode("none");
              }}
              className={fieldCls}
            />
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
              Reorder
            </label>
            <input
              type="number"
              value={reorderVal}
              onChange={(e) => setReorderVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") setMode("none");
              }}
              className={fieldCls}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy}
              className="rounded-control bg-red px-4 py-1.5 font-display text-xs font-bold text-bone transition hover:bg-red-hover active:brightness-95 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="px-2 py-1.5 text-xs text-ink-tertiary hover:text-ink-primary"
            >
              Cancel
            </button>
            {error && (
              <span className="text-xs text-state-bad" role="alert">
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
