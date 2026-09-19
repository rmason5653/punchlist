"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUSINESS_TZ, linenLabel } from "@/lib/constants";
import type { CentralReserveItem } from "@/lib/types";
import { Pill } from "@/app/components/ui";
import { useToast } from "@/app/components/Toast";

function displayName(item: CentralReserveItem): string {
  return item.category === "linen" ? linenLabel(item.item_name) : item.item_name;
}

/**
 * Bulk stock, in three sections: the calculated consumables, the bulk
 * supplies whose targets are set by hand, and linens. Every row offers the
 * same two verbs — Receive a delivery, or Adjust what's editable — so a
 * soap jug and a towel don't read the same and behave differently.
 */
export default function CentralClient({
  items,
  velocityWeeks,
}: {
  items: CentralReserveItem[];
  velocityWeeks: number;
}) {
  const toast = useToast();
  const [buyText, setBuyText] = useState<string | null>(null);

  // Everything at or below reorder with something to buy, as one list that
  // can leave the app — the Stockroom is where the shopping list is born and
  // the digest may or may not be connected.
  const buy = items.filter(
    (i) => i.quantity_on_hand <= i.reorder_point && i.par_level - i.quantity_on_hand > 0,
  );
  function buildBuyList(): string {
    const day = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: BUSINESS_TZ });
    const lines = [`Par buy list · ${day}`];
    const groups: [string, CentralReserveItem[]][] = [
      ["Consumables", buy.filter((i) => i.category === "consumable")],
      ["Linens", buy.filter((i) => i.category === "linen")],
    ];
    for (const [label, rows] of groups) {
      if (rows.length === 0) continue;
      lines.push("", `${label}:`);
      for (const r of rows) {
        lines.push(`${displayName(r)}: ${r.par_level - r.quantity_on_hand} (${r.quantity_on_hand} on hand)`);
      }
    }
    return lines.join("\n");
  }
  async function copyBuyList() {
    const text = buildBuyList();
    try {
      await navigator.clipboard.writeText(text);
      setBuyText(null);
      toast(`Buy list copied — ${buy.length} ${buy.length === 1 ? "item" : "items"}`);
    } catch {
      // No clipboard (old browser, no HTTPS): show it so it can be selected.
      setBuyText(text);
    }
  }

  const sections: { key: string; label: string; note?: React.ReactNode; rows: CentralReserveItem[] }[] = [
    {
      key: "consumable",
      label: "Consumables",
      note: (
        <>
          <b className="text-ink-secondary">Reorder</b> is one week of what&apos;s
          actually been pulled (last {velocityWeeks} weeks);{" "}
          <b className="text-ink-secondary">par</b> is that × the Stockroom buffer
          in{" "}
          <Link href="/settings" className="text-ink-secondary underline underline-offset-2 hover:text-ink-primary">
            Settings
          </Link>
          . An item with nothing pulled lately uses its whole-log average; one
          never pulled uses the estimate from leave-behind × turnovers. Adjust
          only the count here.
        </>
      ),
      rows: items.filter((i) => i.category === "consumable" && !i.fixed_par),
    },
    {
      key: "bulk",
      label: "Bulk supplies",
      note: "Jugs that live in the closets. Targets are set by hand.",
      rows: items.filter((i) => i.category === "consumable" && i.fixed_par),
    },
    {
      key: "linen",
      label: "Linens",
      note: "Replacement stock. Targets are set by hand.",
      rows: items.filter((i) => i.category === "linen"),
    },
  ];

  return (
    <div className="space-y-8">
      {buy.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-card border border-line bg-surface-2 px-4 py-3">
          <p className="m-0 text-sm text-ink-secondary">
            <b className="text-ink-primary">{buy.length}</b> {buy.length === 1 ? "item" : "items"} to buy to
            bring the Stockroom to par.
          </p>
          <button
            type="button"
            onClick={copyBuyList}
            className="min-h-9 rounded-control border border-line-strong bg-surface-3 px-3 font-display text-xs font-bold text-ink-primary transition hover:border-red active:brightness-95"
          >
            Copy buy list
          </button>
          {buyText && (
            <textarea
              readOnly
              value={buyText}
              aria-label="Buy list"
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 min-h-40 w-full rounded-control border border-line-strong bg-surface-3 p-3 font-mono text-xs text-ink-primary"
            />
          )}
        </div>
      )}
      {sections.map((g) => {
        if (g.rows.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
              {g.label}
            </h2>
            {g.note && <p className="mb-3 mt-1 text-xs text-ink-muted">{g.note}</p>}
            <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
              {g.rows.map((item, idx) => (
                <Row key={item.id} item={item} first={idx === 0} velocityWeeks={velocityWeeks} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Row({
  item,
  first,
  velocityWeeks,
}: {
  item: CentralReserveItem;
  first: boolean;
  velocityWeeks: number;
}) {
  const router = useRouter();
  const toast = useToast();
  // receive: add a delivery. adjust: recount (and, for hand-set items, retarget).
  const [mode, setMode] = useState<"none" | "receive" | "adjust">("none");
  const [addVal, setAddVal] = useState("");
  const [countVal, setCountVal] = useState(String(item.quantity_on_hand));
  const [parVal, setParVal] = useState(String(item.par_level));
  const [reorderVal, setReorderVal] = useState(String(item.reorder_point));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const low = item.quantity_on_hand <= item.reorder_point;
  const toPar = Math.max(0, item.par_level - item.quantity_on_hand);
  const handSet = item.category === "linen" || item.fixed_par;

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

  function open(next: "receive" | "adjust") {
    setMode(next);
    setAddVal("");
    setCountVal(String(item.quantity_on_hand));
    setParVal(String(item.par_level));
    setReorderVal(String(item.reorder_point));
    setError("");
  }

  function bumpCount(delta: number) {
    setCountVal((v) => String(Math.max(0, (parseInt(v, 10) || 0) + delta)));
  }

  function saveReceive() {
    const n = parseInt(addVal, 10);
    if (!Number.isInteger(n) || n < 1) {
      setError("How many arrived? A whole number, 1 or more.");
      return;
    }
    void send({ add: n }, `Received ${n} ${displayName(item)} → ${item.quantity_on_hand + n} on hand`);
  }

  // Save only what actually changed (keeps the audit clean).
  function saveAdjust() {
    const c = parseInt(countVal, 10);
    const p = handSet ? parseInt(parVal, 10) : item.par_level;
    const r = handSet ? parseInt(reorderVal, 10) : item.reorder_point;
    if ([c, p, r].some((n) => !Number.isInteger(n) || n < 0)) {
      setError("Whole numbers, zero or more.");
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
    ]
      .filter(Boolean)
      .join(", ");
    void send(body, `${displayName(item)}: ${what}`);
  }

  const fieldCls =
    "tnum min-h-11 w-24 rounded-control border border-line-strong bg-surface-3 px-2.5 py-1.5 text-sm text-ink-primary outline-none focus:border-red";
  const stepBtn =
    "h-11 w-11 shrink-0 rounded-control border border-line-strong bg-surface-3 text-lg font-bold text-ink-secondary transition hover:border-red hover:text-ink-primary active:brightness-95";
  const actionBtn = (on: boolean) =>
    `min-h-9 rounded-control border px-3 text-xs font-semibold transition ${
      on
        ? "border-red bg-surface-3 text-ink-primary"
        : "border-line-strong bg-surface-3 text-ink-secondary hover:border-red hover:text-ink-primary"
    }`;
  const saveBtn =
    "min-h-11 rounded-control bg-red px-4 font-display text-xs font-bold text-bone transition hover:bg-red-hover active:brightness-95 disabled:opacity-50";
  const cancelBtn = "min-h-11 px-2 text-xs text-ink-tertiary hover:text-ink-primary";
  const labelCls = "w-16 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary";
  const onKeys = (save: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setMode("none");
  };

  return (
    <div className={first ? "" : "border-t border-line"}>
      {/* On a phone the name takes the whole first line and the numbers and
          actions wrap to a second. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <div className="text-sm font-medium text-ink-primary">{displayName(item)}</div>
          <div className="tnum text-[11px] text-ink-muted">
            par {item.par_level} · reorder {item.reorder_point}
            {item.target_basis === "pulls" && ` · ~${item.weekly_use}/wk pulled`}
            {item.target_basis === "history" &&
              ` · ~${item.weekly_use}/wk over the whole log, nothing pulled in ${velocityWeeks} wks`}
            {item.target_basis === "calculated" && " · estimate, no pulls yet"}
          </div>
        </div>

        <div className="mr-auto w-20 text-left sm:mr-0 sm:text-right">
          <div className="tnum font-display text-2xl font-extrabold tracking-[-0.03em] text-ink-primary">
            {item.quantity_on_hand}
          </div>
          {/* "buy N" only when it's actually time to buy. */}
          {low && toPar > 0 && (
            <div className="tnum text-[11px] font-semibold text-state-warn">buy {toPar}</div>
          )}
        </div>

        <div className="w-14 text-right">
          {low ? <Pill tone="warn">Low</Pill> : <Pill tone="ok">OK</Pill>}
        </div>

        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => (mode === "receive" ? setMode("none") : open("receive"))}
            aria-expanded={mode === "receive"}
            className={actionBtn(mode === "receive")}
          >
            Receive
          </button>
          <button
            type="button"
            onClick={() => (mode === "adjust" ? setMode("none") : open("adjust"))}
            aria-expanded={mode === "adjust"}
            className={actionBtn(mode === "adjust")}
          >
            Adjust
          </button>
        </div>
      </div>

      {mode === "receive" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-1 px-4 py-2.5">
          <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
            Arrived
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            autoFocus
            value={addVal}
            onChange={(e) => setAddVal(e.target.value)}
            onKeyDown={onKeys(saveReceive)}
            placeholder="0"
            aria-label={`How many ${displayName(item)} arrived`}
            className={`${fieldCls} text-center`}
          />
          <span className="tnum text-xs text-ink-muted">
            → {item.quantity_on_hand + (parseInt(addVal, 10) || 0)} on hand
          </span>
          <button type="button" onClick={saveReceive} disabled={busy} className={saveBtn}>
            {busy ? "…" : "Add to stock"}
          </button>
          <button type="button" onClick={() => setMode("none")} className={cancelBtn}>
            Cancel
          </button>
          {error && (
            <span className="text-xs text-state-bad" role="alert">
              {error}
            </span>
          )}
        </div>
      )}

      {mode === "adjust" && (
        <div className="space-y-2 border-t border-line bg-surface-1 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className={labelCls}>On hand</label>
            <button type="button" onClick={() => bumpCount(-1)} aria-label="Decrease by one" className={stepBtn}>
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={countVal}
              onChange={(e) => setCountVal(e.target.value)}
              onKeyDown={onKeys(saveAdjust)}
              aria-label={`${displayName(item)} counted on hand`}
              className={`${fieldCls} text-center`}
            />
            <button type="button" onClick={() => bumpCount(1)} aria-label="Increase by one" className={stepBtn}>
              +
            </button>
          </div>
          {handSet && (
            <div className="flex flex-wrap items-center gap-2">
              <label className={labelCls}>Par</label>
              <input
                type="number"
                value={parVal}
                onChange={(e) => setParVal(e.target.value)}
                onKeyDown={onKeys(saveAdjust)}
                aria-label={`${displayName(item)} par`}
                className={fieldCls}
              />
              <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
                Reorder
              </label>
              <input
                type="number"
                value={reorderVal}
                onChange={(e) => setReorderVal(e.target.value)}
                onKeyDown={onKeys(saveAdjust)}
                aria-label={`${displayName(item)} reorder point`}
                className={fieldCls}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={saveAdjust} disabled={busy} className={saveBtn}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setMode("none")} className={cancelBtn}>
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
