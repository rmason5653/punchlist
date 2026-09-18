"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Unit } from "@/lib/types";

const ROLLAWAY_MAX = 4;

// Admin control for the two things that can't be read off a unit's linen: whether it
// has a queen pullout couch, and how many twin rollaways it carries. Both mean
// bedding sits bagged in the closet, which is what the clean flow warns about.
// Set here rather than only per-unit so a building can be done in one pass.
export default function UnitPropsClient({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [pullout, setPullout] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(units.map((u) => [u.unit_id, u.has_pullout])),
  );
  const [rollaway, setRollaway] = useState<Record<string, number>>(() =>
    Object.fromEntries(units.map((u) => [u.unit_id, u.rollaway_beds])),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Keep the page's own grouping: properties in unit sort order, units within.
  const groups = useMemo(() => {
    const by = new Map<string, Unit[]>();
    for (const u of units) {
      const arr = by.get(u.property_name) ?? [];
      arr.push(u);
      by.set(u.property_name, arr);
    }
    return [...by.entries()];
  }, [units]);

  async function save(u: Unit, patch: Record<string, unknown>, apply: () => void) {
    setBusyId(u.unit_id);
    setError("");
    try {
      const res = await fetch(`/api/units/${u.unit_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save.");
      }
      apply();
      router.refresh();
    } catch (e) {
      setError(`${u.name}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  const togglePullout = (u: Unit) => {
    const next = !pullout[u.unit_id];
    return save(u, { has_pullout: next }, () =>
      setPullout((p) => ({ ...p, [u.unit_id]: next })),
    );
  };

  const setRollaways = (u: Unit, n: number) => {
    const next = Math.max(0, Math.min(ROLLAWAY_MAX, n));
    if (next === (rollaway[u.unit_id] ?? 0)) return Promise.resolve();
    return save(u, { rollaway_beds: next }, () =>
      setRollaway((p) => ({ ...p, [u.unit_id]: next })),
    );
  };

  const pulloutCount = Object.values(pullout).filter(Boolean).length;
  const rollawayCount = Object.values(rollaway).filter((n) => n > 0).length;

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-ink-tertiary">
        Both of these mean a unit keeps bedding{" "}
        <b className="text-ink-secondary">bagged in the closet</b> instead of
        made up on the bed, and both drive the reminder a cleaner sees mid-clean.
        Neither can be read off the linen — a queen main bed and a standing twin
        use the same sizes — so they&apos;re set here. Changes save as you tap.
      </p>

      <Grid
        title="Queen pullout couch"
        hint="Tap a unit to turn it on or off."
        tally={`${pulloutCount} of ${units.length} units`}
        groups={groups}
        busyId={busyId}
        onTap={togglePullout}
        isOn={(u) => pullout[u.unit_id]}
        render={(_u, short) => short}
      />

      <Grid
        title="Twin rollaway beds"
        hint="Tap a unit, then − / + to set how many. One bag per rollaway."
        tally={`${rollawayCount} of ${units.length} units`}
        groups={groups}
        busyId={busyId}
        isOn={(u) => (rollaway[u.unit_id] ?? 0) > 0}
        render={(u, short) =>
          rollaway[u.unit_id] > 0 ? `${short} ×${rollaway[u.unit_id]}` : short
        }
        stepper={{
          value: (u) => rollaway[u.unit_id] ?? 0,
          max: ROLLAWAY_MAX,
          onSet: setRollaways,
        }}
      />

      {error && (
        <p className="text-sm text-state-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Grid({
  title,
  hint,
  tally,
  groups,
  busyId,
  onTap,
  isOn,
  render,
  stepper,
}: {
  title: string;
  hint: string;
  tally: string;
  groups: [string, Unit[]][];
  busyId: string | null;
  /** Toggle grids: a tap flips the unit. */
  onTap?: (u: Unit) => void;
  isOn: (u: Unit) => boolean;
  render: (u: Unit, short: string) => string;
  /** Count grids: a tap opens −/+ in place of the chip. */
  stepper?: { value: (u: Unit) => number; max: number; onSet: (u: Unit, n: number) => void };
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const stepBtn =
    "h-9 w-9 shrink-0 rounded-control border border-line-strong bg-surface-3 text-base font-bold text-ink-secondary transition hover:border-red hover:text-ink-primary active:brightness-95 disabled:opacity-40";

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {title}
        </span>
        <span className="tnum text-xs text-ink-tertiary">{tally}</span>
        <span className="w-full text-[11px] text-ink-muted">{hint}</span>
      </div>

      {groups.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-ink-tertiary">No units yet.</p>
      )}
      {groups.map(([property, list], idx) => (
        <div
          key={property}
          className={`px-4 py-3 ${idx > 0 ? "border-t border-line" : ""}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {property}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {list.map((u) => {
              const on = isOn(u);
              const busy = busyId === u.unit_id;
              // Strip the redundant property prefix — "Highland 1209 H" reads
              // as "1209 H" under its own heading.
              const short = u.name.startsWith(`${property} `)
                ? u.name.slice(property.length + 1)
                : u.name;

              if (stepper && editing === u.unit_id) {
                const n = stepper.value(u);
                return (
                  <span
                    key={u.unit_id}
                    role="group"
                    aria-label={`${u.name} rollaway beds`}
                    className="inline-flex items-center gap-1.5 rounded-control border border-red bg-surface-3 px-2 py-1"
                  >
                    <span className="tnum text-xs font-semibold text-ink-primary">{short}</span>
                    <button
                      type="button"
                      onClick={() => stepper.onSet(u, n - 1)}
                      disabled={busy || n <= 0}
                      aria-label={`Fewer rollaways for ${u.name}`}
                      className={stepBtn}
                    >
                      −
                    </button>
                    <span className="tnum w-5 text-center text-sm font-bold text-ink-primary">
                      {busy ? "…" : n}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepper.onSet(u, n + 1)}
                      disabled={busy || n >= stepper.max}
                      aria-label={`More rollaways for ${u.name}`}
                      className={stepBtn}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="min-h-9 rounded-control px-2 text-xs font-semibold text-ink-tertiary hover:text-ink-primary"
                    >
                      Done
                    </button>
                  </span>
                );
              }

              return (
                <button
                  key={u.unit_id}
                  type="button"
                  onClick={() => (stepper ? setEditing(u.unit_id) : onTap?.(u))}
                  disabled={busy}
                  aria-pressed={stepper ? undefined : on}
                  aria-expanded={stepper ? false : undefined}
                  className={`tnum min-h-9 rounded-control border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    on
                      ? "border-[rgba(31,138,76,.5)] bg-green-subtle text-state-ok"
                      : "border-line-strong bg-surface-3 text-ink-tertiary hover:border-red hover:text-ink-primary"
                  }`}
                >
                  {busy ? "…" : render(u, short)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
