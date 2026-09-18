"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Unit } from "@/lib/types";

const ROLLAWAY_MAX = 2;

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

  const cycleRollaway = (u: Unit) => {
    const next = ((rollaway[u.unit_id] ?? 0) + 1) % (ROLLAWAY_MAX + 1);
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
        hint="Tap to turn on or off."
        tally={`${pulloutCount} of ${units.length} units`}
        groups={groups}
        busyId={busyId}
        onTap={togglePullout}
        isOn={(u) => pullout[u.unit_id]}
        render={(_u, short) => short}
      />

      <Grid
        title="Twin rollaway beds"
        hint={`Tap to cycle 0 → ${[...Array(ROLLAWAY_MAX)].map((_, i) => i + 1).join(" → ")} → 0. One bag per rollaway.`}
        tally={`${rollawayCount} of ${units.length} units`}
        groups={groups}
        busyId={busyId}
        onTap={cycleRollaway}
        isOn={(u) => (rollaway[u.unit_id] ?? 0) > 0}
        render={(u, short) =>
          rollaway[u.unit_id] > 0 ? `${short} ×${rollaway[u.unit_id]}` : short
        }
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
}: {
  title: string;
  hint: string;
  tally: string;
  groups: [string, Unit[]][];
  busyId: string | null;
  onTap: (u: Unit) => void;
  isOn: (u: Unit) => boolean;
  render: (u: Unit, short: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          {title}
        </span>
        <span className="tnum text-xs text-ink-tertiary">{tally}</span>
        <span className="w-full text-[11px] text-ink-muted">{hint}</span>
      </div>

      {groups.map(([property, list], idx) => (
        <div
          key={property}
          className={`px-4 py-3 ${idx > 0 ? "border-t border-line" : ""}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {property}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {list.map((u) => {
              const on = isOn(u);
              const busy = busyId === u.unit_id;
              // Strip the redundant property prefix — "Highland 1209 H" reads
              // as "1209 H" under its own heading.
              const short = u.name.startsWith(`${property} `)
                ? u.name.slice(property.length + 1)
                : u.name;
              return (
                <button
                  key={u.unit_id}
                  type="button"
                  onClick={() => onTap(u)}
                  disabled={busy}
                  aria-pressed={on}
                  className={`tnum rounded-control border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
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
