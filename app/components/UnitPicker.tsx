"use client";

import { useEffect, useMemo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { Pill, formatWhen } from "./ui";

export interface UnitSummary {
  unit_id: string;
  name: string;
  property_name: string;
  parking_pass_label: string;
  parking_status: string;
  last_cleaned_at: string | null;
  consLow: number;
  linenShort: number;
}

const COLLAPSED_KEY = "mason_inv_collapsed";
const SCOPE_KEY = "mason_inv_scope";

export default function UnitPicker({
  units,
  recent = [],
  mine = [],
}: {
  units: UnitSummary[];
  recent?: UnitSummary[];
  /** Unit ids this person has cleaned before. When there are any, the picker
   *  opens on them — one crew's nine units, not the whole portfolio. */
  mine?: string[];
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const mineSet = useMemo(() => new Set(mine), [mine]);
  const mineList = useMemo(() => units.filter((u) => mineSet.has(u.unit_id)), [units, mineSet]);
  const hasMine = mineList.length > 0;
  const [scope, setScope] = useState<"mine" | "all">("mine");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCOPE_KEY);
      if (saved === "all" || saved === "mine") setScope(saved);
    } catch {
      /* ignore */
    }
  }, []);
  function pickScope(next: "mine" | "all") {
    setScope(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* ignore */
    }
  }
  const showMine = hasMine && scope === "mine";
  // Buildings a person has folded away, remembered on this device. Citizen is
  // 39 cards; someone working Highland shouldn't scroll past it every time.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((s) => typeof s === "string")));
    } catch {
      /* ignore */
    }
  }, []);
  function toggleBuilding(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // A search always looks at every unit; the scope only shapes the browse.
  const filtered = useMemo(
    () =>
      query
        ? units.filter(
            (u) =>
              u.name.toLowerCase().includes(query) ||
              u.property_name.toLowerCase().includes(query),
          )
        : showMine
          ? mineList
          : units,
    [units, mineList, showMine, query],
  );

  // Group by building, preserving the sorted order.
  const groups = useMemo(() => {
    const m = new Map<string, UnitSummary[]>();
    for (const u of filtered) {
      const arr = m.get(u.property_name) ?? [];
      arr.push(u);
      m.set(u.property_name, arr);
    }
    return [...m.entries()];
  }, [filtered]);

  return (
    <div>
      {recent.length > 0 && !query && !showMine && (
        <div className="mb-5">
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
            Your recent units
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((u) => (
              <Link
                key={u.unit_id}
                href={`/unit/${u.unit_id}`}
                className="min-h-11 shrink-0 rounded-control border border-line-strong bg-surface-3 px-3.5 py-2 text-sm font-semibold text-ink-primary transition hover:border-red active:brightness-95"
              >
                {u.name}
                <span className="ml-2 tnum text-[11px] font-normal text-ink-muted">
                  {formatWhen(u.last_cleaned_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pinned under the nav so it's never a scroll away. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 bg-surface-0 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your unit… e.g. Citizen 305"
          aria-label="Search units"
          className="min-h-11 w-full rounded-control border border-line-strong bg-surface-3 px-4 py-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-red"
        />
      </div>

      {hasMine && !query && (
        <div
          role="group"
          aria-label="Which units to show"
          className="mb-5 inline-flex rounded-control border border-line-strong bg-surface-2 p-0.5"
        >
          {(
            [
              ["mine", `Your units`, mineList.length],
              ["all", `All units`, units.length],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => pickScope(key)}
              aria-pressed={scope === key}
              className={`min-h-9 rounded-[6px] px-3.5 text-sm font-semibold transition ${
                scope === key
                  ? "bg-surface-4 text-ink-primary shadow-e1"
                  : "text-ink-tertiary hover:text-ink-primary"
              }`}
            >
              {label}
              <span className="ml-1.5 tnum text-xs font-medium text-ink-muted">{n}</span>
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-ink-tertiary">
          No units match &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(([building, list]) => {
            // A search always shows its matches; folding only applies to the
            // full list.
            const folded = !query && collapsed.has(building);
            return (
              <section key={building}>
                <button
                  type="button"
                  onClick={() => toggleBuilding(building)}
                  aria-expanded={!folded}
                  className="mb-3 flex min-h-9 w-full items-center gap-2 text-left font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={`shrink-0 text-ink-muted transition-transform duration-150 ${folded ? "-rotate-90" : ""}`}
                  >
                    <path d="M5 7.5l5 5 5-5" />
                  </svg>
                  {building}
                  <span className="text-xs font-medium text-ink-muted">{list.length}</span>
                </button>
                {!folded && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((u) => (
                      <UnitCard key={u.unit_id} u={u} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnitCard({ u }: { u: UnitSummary }) {
  const allGood =
    u.consLow === 0 && u.linenShort === 0 && u.parking_status !== "missing";
  return (
    <Link
      href={`/unit/${u.unit_id}`}
      className="group rounded-card border border-line bg-surface-2 p-4 shadow-e1 transition duration-150 ease-out hover:-translate-y-px hover:border-line-strong hover:bg-surface-3 hover:shadow-e2 active:translate-y-0 active:bg-surface-3 active:brightness-95"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-base font-bold text-ink-primary">
            {u.name}
          </div>
          {u.parking_pass_label !== "None" && (
            <div className="text-xs text-ink-muted">Parking: {u.parking_pass_label}</div>
          )}
        </div>
        <OpeningMark />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {allGood && <Pill tone="ok">All good</Pill>}
        {u.consLow > 0 && <Pill tone="warn">{u.consLow} to restock</Pill>}
        {u.linenShort > 0 && <Pill tone="bad">{u.linenShort} linen short</Pill>}
        {u.parking_status === "missing" && <Pill tone="bad">Pass missing</Pill>}
      </div>

      <div className="mt-3 text-[11px] text-ink-muted">
        Last cleaned {formatWhen(u.last_cleaned_at)}
      </div>
    </Link>
  );
}

/** The card's arrow, which turns into "Opening…" the moment it's tapped —
 *  the next page's skeleton takes over from there. Must be a child of Link. */
function OpeningMark() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-state-warn">
      Opening…
    </span>
  ) : (
    <span className="text-ink-muted transition group-hover:text-ink-tertiary">→</span>
  );
}
