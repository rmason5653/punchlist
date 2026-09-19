"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import { useConfirm } from "@/app/components/ConfirmSheet";

/**
 * The manager's per-unit knobs that aren't about linen: how often this unit
 * really turns over (drives its closet par), and taking it out of the
 * portfolio when it goes. Both sit under the clean steps with the other
 * manager tools.
 */
export default function UnitAdmin({
  unitId,
  name,
  turnover,
  defaultTurnover,
  measured,
  retired,
}: {
  unitId: string;
  name: string;
  /** This unit's own turnovers a week; null means the global default. */
  turnover: number | null;
  defaultTurnover: number;
  measured: { weeks: number; cleans: number; perWeek: number };
  retired: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirmSheet = useConfirm();
  const [freq, setFreq] = useState(turnover == null ? "" : String(turnover));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = freq.trim() !== (turnover == null ? "" : String(turnover));

  async function patch(body: Record<string, unknown>, done: string): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save.");
      }
      toast(done);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveTurnover() {
    const v = freq.trim();
    const n = v === "" ? null : Number(v);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 14)) {
      setError("A whole number from 1 to 14, or blank for the default.");
      return;
    }
    const ok = await patch(
      { turnover_frequency: n },
      n === null
        ? `${name}: back to the default of ${defaultTurnover} a week — par recalculated`
        : `${name}: ${n} ${n === 1 ? "turnover" : "turnovers"} a week — par recalculated`,
    );
    if (ok) router.refresh();
  }

  async function retire() {
    const ok = await confirmSheet({
      title: `Retire ${name}?`,
      body: "It leaves every list and the restock run. Its pulls and cleans stay in the logs, and you can restore it from Settings.",
      confirmLabel: "Retire",
      danger: true,
    });
    if (!ok) return;
    if (await patch({ retired: true }, `${name} retired — restore it from Settings if it comes back`)) {
      router.push("/");
      router.refresh();
    }
  }

  async function restore() {
    if (await patch({ retired: false }, `${name} is back in the portfolio`)) router.refresh();
  }

  const field =
    "tnum min-h-11 w-24 rounded-control border border-line-strong bg-surface-3 px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-red";
  const ghost =
    "min-h-10 rounded-control border border-line-strong bg-surface-3 px-3.5 font-display text-xs font-bold text-ink-primary transition hover:border-red active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section className="rounded-card border border-line bg-surface-2 shadow-e1">
      {!retired && (
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
              Turnover
            </span>
            <span className="text-[11px] text-ink-muted">Sets this unit&apos;s closet par</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor={`turnover-${unitId}`} className="text-sm text-ink-secondary">
              Turnovers / week
            </label>
            <input
              id={`turnover-${unitId}`}
              inputMode="numeric"
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty) void saveTurnover();
              }}
              placeholder={`${defaultTurnover} (default)`}
              className={field}
            />
            <button type="button" onClick={saveTurnover} disabled={busy || !dirty} className={ghost}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {measured.cleans === 0
              ? `No cleans logged here in the last ${measured.weeks} weeks.`
              : `Measured: ${measured.cleans} ${measured.cleans === 1 ? "clean" : "cleans"} in the last ${measured.weeks} weeks, about ${measured.perWeek.toFixed(1)} a week.`}{" "}
            Blank uses the default of {defaultTurnover} from Settings.
          </p>
        </div>
      )}

      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${retired ? "" : "border-t border-line"}`}>
        <div className="min-w-0 text-sm text-ink-secondary">
          {retired
            ? "Bring it back and it returns to every list with its history intact."
            : "Leaving the portfolio? Retiring hides it everywhere and keeps its history."}
        </div>
        {retired ? (
          <button type="button" onClick={restore} disabled={busy} className={ghost}>
            Restore unit
          </button>
        ) : (
          <button
            type="button"
            onClick={retire}
            disabled={busy}
            className="min-h-10 rounded-control border border-line-strong bg-surface-3 px-3.5 font-display text-xs font-bold text-state-bad transition hover:border-red active:brightness-95 disabled:opacity-50"
          >
            Retire this unit
          </button>
        )}
      </div>

      {error && (
        <p className="px-5 pb-4 text-sm text-state-bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
