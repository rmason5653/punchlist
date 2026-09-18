"use client";

import { useMemo, useState } from "react";
import { linenLabel } from "@/lib/constants";
import { ParBar, Pill } from "@/app/components/ui";
import PullDialog from "@/app/components/PullDialog";
import type { LinenPar } from "@/lib/types";

export interface LinenUnit {
  unit_id: string;
  name: string;
  property_name: string;
  linens: LinenPar[];
  short: number;
}

/**
 * Loss detection, short-first: the units below par get the full card; the
 * (usually sixty) units at par collapse into a row of chips per building,
 * each of which opens its card in place. Sixty-three cards was a 38,000px
 * scroll on a phone with three that mattered.
 */
export default function LinensClient({ units }: { units: LinenUnit[] }) {
  const shortUnits = units.filter((u) => u.short > 0);
  const atPar = units.filter((u) => u.short === 0);
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const groups = useMemo(() => {
    const m = new Map<string, LinenUnit[]>();
    for (const u of atPar) {
      const arr = m.get(u.property_name) ?? [];
      arr.push(u);
      m.set(u.property_name, arr);
    }
    return [...m.entries()];
  }, [atPar]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {shortUnits.length === 0 ? (
        <p className="rounded-card border border-line bg-surface-2 p-8 text-center text-sm text-ink-tertiary">
          Every unit is at par. Nothing to replace.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {shortUnits.map((u) => (
            <UnitCard key={u.unit_id} u={u} />
          ))}
        </div>
      )}

      {atPar.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
              At par
              <span className="ml-2 tnum text-xs font-medium text-ink-muted">
                {atPar.length} {atPar.length === 1 ? "unit" : "units"}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              aria-expanded={showAll}
              className="min-h-9 rounded-control px-2 text-xs font-semibold text-ink-tertiary transition hover:text-ink-primary"
            >
              {showAll ? "Collapse" : "Show every card"}
            </button>
          </div>

          {showAll ? (
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {atPar.map((u) => (
                <UnitCard key={u.unit_id} u={u} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(([property, list]) => (
                <div key={property}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    {property}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {list.map((u) => {
                      const short = u.name.startsWith(`${property} `)
                        ? u.name.slice(property.length + 1)
                        : u.name;
                      const isOpen = open.has(u.unit_id);
                      return (
                        <button
                          key={u.unit_id}
                          type="button"
                          onClick={() => toggle(u.unit_id)}
                          aria-expanded={isOpen}
                          className={`tnum min-h-9 rounded-control border px-3 text-xs font-semibold transition ${
                            isOpen
                              ? "border-red bg-surface-3 text-ink-primary"
                              : "border-line-strong bg-surface-3 text-ink-secondary hover:border-red hover:text-ink-primary"
                          }`}
                        >
                          {short}
                        </button>
                      );
                    })}
                  </div>
                  {list.some((u) => open.has(u.unit_id)) && (
                    <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                      {list
                        .filter((u) => open.has(u.unit_id))
                        .map((u) => (
                          <UnitCard key={u.unit_id} u={u} />
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function UnitCard({ u }: { u: LinenUnit }) {
  const isShort = u.short > 0;
  return (
    <div
      className={`rounded-card border bg-surface-2 p-5 shadow-e1 ${
        isShort ? "border-[rgba(226,6,2,.35)]" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-display text-base font-bold text-ink-primary">{u.name}</div>
        {isShort ? <Pill tone="bad">{u.short} short</Pill> : <Pill tone="ok">At par</Pill>}
      </div>

      <ul className="mt-3 space-y-2.5">
        {u.linens.map((l) => {
          const shortBy = l.par_count - l.current_actual;
          const isRowShort = shortBy > 0;
          return (
            <li key={l.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-secondary">{linenLabel(l.linen_type)}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`tnum text-xs ${isRowShort ? "text-state-bad" : "text-ink-tertiary"}`}
                  >
                    {l.current_actual} / {l.par_count}
                  </span>
                  {isRowShort && (
                    <PullDialog
                      label={`Replace ${shortBy}`}
                      variant="small"
                      prefill={{
                        item_name: l.linen_type,
                        category: "linen",
                        unit_id: u.unit_id,
                        reason: "damage_replacement",
                        quantity: shortBy,
                      }}
                    />
                  )}
                </div>
              </div>
              <div className="mt-1.5">
                <ParBar actual={l.current_actual} par={l.par_count} tone={isRowShort ? "bad" : "ok"} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
