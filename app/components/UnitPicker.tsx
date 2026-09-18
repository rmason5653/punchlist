"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

export default function UnitPicker({ units }: { units: UnitSummary[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      query
        ? units.filter(
            (u) =>
              u.name.toLowerCase().includes(query) ||
              u.property_name.toLowerCase().includes(query),
          )
        : units,
    [units, query],
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
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your unit…  e.g. Citizen 305"
        aria-label="Search units"
        className="mb-6 w-full rounded-control border border-line-strong bg-surface-3 px-4 py-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-red"
      />

      {groups.length === 0 ? (
        <p className="text-sm text-ink-tertiary">
          No units match &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(([building, list]) => (
            <section key={building}>
              <h3 className="mb-3 flex items-baseline gap-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
                {building}
                <span className="text-xs font-medium text-ink-muted">
                  {list.length}
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((u) => (
                  <UnitCard key={u.unit_id} u={u} />
                ))}
              </div>
            </section>
          ))}
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
      className="group rounded-card border border-line bg-surface-2 p-4 shadow-e1 transition duration-150 ease-out hover:-translate-y-px hover:border-line-strong hover:bg-surface-3 hover:shadow-e2"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-base font-bold text-ink-primary">
            {u.name}
          </div>
          <div className="text-xs text-ink-muted">
            {u.parking_pass_label === "None"
              ? "No parking pass"
              : `Parking: ${u.parking_pass_label}`}
          </div>
        </div>
        <span className="text-ink-muted transition group-hover:text-ink-tertiary">
          →
        </span>
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
