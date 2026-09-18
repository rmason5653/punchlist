"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StaffSelect from "@/app/components/StaffSelect";
import { useConfirm } from "@/app/components/ConfirmSheet";
import { useToast } from "@/app/components/Toast";

export interface RestockRun {
  unit_id: string;
  unit_name: string;
  property_name: string;
  items: {
    item_name: string;
    needed: number;
    closet_par: number;
    current_actual: number;
  }[];
}

export interface PickItem {
  item_name: string;
  needed: number;
  on_hand: number;
  short: boolean;
}

const STAFF_KEY = "mason_inv_staff";

export default function RestockClient({
  runs,
  pickList,
  staffNames,
  viewerName,
}: {
  runs: RestockRun[];
  pickList: PickItem[];
  staffNames: string[];
  viewerName: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [staff, setStaff] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyProperty, setBusyProperty] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // The logged-in user is who's doing the work — default to them. The
    // last-picked name is only a fallback (e.g. an off-roster admin session).
    const remembered = localStorage.getItem(STAFF_KEY) ?? "";
    setStaff(
      viewerName && staffNames.includes(viewerName)
        ? viewerName
        : staffNames.includes(remembered)
          ? remembered
          : viewerName || "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Items central can't fully cover — surfaced on each unit row so "Refill to
  // par" doesn't silently claim stock the run didn't actually have.
  const shortSet = useMemo(
    () => new Set(pickList.filter((p) => p.short).map((p) => p.item_name)),
    [pickList],
  );

  // A restock run is a driving route: do every low unit at one property before
  // moving on. Group the cards the way the run is actually walked.
  const groups = useMemo(() => {
    const m = new Map<string, RestockRun[]>();
    for (const r of runs) {
      const arr = m.get(r.property_name) ?? [];
      arr.push(r);
      m.set(r.property_name, arr);
    }
    return [...m.entries()].map(([property, units]) => ({
      property,
      units,
      total: units.reduce(
        (s, u) => s + u.items.reduce((t, i) => t + i.needed, 0),
        0,
      ),
    }));
  }, [runs]);

  function requireStaff(): boolean {
    if (!staff.trim()) {
      setError("Pick your name first so the pulls are logged to you.");
      return false;
    }
    localStorage.setItem(STAFF_KEY, staff.trim());
    return true;
  }

  /** Refills one unit; resolves to the number of pulls it logged. */
  async function restockUnit(unitId: string): Promise<number> {
    const res = await fetch("/api/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_name: staff.trim(), unit_id: unitId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Could not complete the restock.");
    return Number(d.restocked ?? 0);
  }
  const pulls = (n: number) => `${n} ${n === 1 ? "pull" : "pulls"} logged`;

  async function complete(run: RestockRun) {
    if (!requireStaff()) return;
    setBusyId(run.unit_id);
    setError("");
    try {
      const n = await restockUnit(run.unit_id);
      toast(`${run.unit_name} refilled — ${pulls(n)}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function restockProperty(property: string, units: RestockRun[]) {
    if (!requireStaff()) return;
    setBusyProperty(property);
    setError("");
    let done = 0;
    let logged = 0;
    try {
      for (const run of units) {
        logged += await restockUnit(run.unit_id);
        done += 1;
      }
      toast(`${units.length} units refilled at ${property} — ${pulls(logged)}`);
      router.refresh();
    } catch (e) {
      setError(`${(e as Error).message} (${done}/${units.length} done at ${property})`);
    } finally {
      setBusyProperty(null);
    }
  }

  async function restockAll() {
    if (!requireStaff()) return;
    // Marks every unit done at once — guard it so an early tap can't claim a
    // run that hasn't physically happened yet.
    const ok = await confirm({
      title: `Mark all ${runs.length} units refilled to par?`,
      body: "Only do this after you've physically restocked every closet on the list. Each unit's pulls are logged under your name.",
      confirmLabel: `Refill all ${runs.length}`,
    });
    if (!ok) return;
    setAllBusy(true);
    setError("");
    let done = 0;
    let logged = 0;
    try {
      for (const run of runs) {
        setProgress({ done, total: runs.length });
        logged += await restockUnit(run.unit_id);
        done += 1;
      }
      setProgress({ done, total: runs.length });
      toast(`${runs.length} units refilled — ${pulls(logged)}`);
      router.refresh();
    } catch (e) {
      setError(`${(e as Error).message} (${done}/${runs.length} done)`);
    } finally {
      setAllBusy(false);
      setProgress(null);
    }
  }

  const busy = allBusy || busyId !== null || busyProperty !== null;
  const grandTotal = pickList.reduce((s, p) => s + p.needed, 0);

  return (
    <div>
      {/* Control bar — who's running it + restock everything at once. */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface-2 p-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          Restocking as
        </label>
        <StaffSelect
          value={staff}
          onChange={setStaff}
          names={staffNames}
          className="w-40 rounded-control border border-line-strong bg-surface-3 px-3 py-2 text-sm text-ink-primary outline-none focus:border-red"
        />
        <button
          type="button"
          onClick={restockAll}
          disabled={busy}
          className="ml-auto min-h-10 rounded-control bg-red px-4 py-2 font-display text-sm font-bold text-bone transition duration-150 ease-out hover:bg-red-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allBusy
            ? `Restocking ${progress?.done ?? 0}/${progress?.total ?? runs.length}…`
            : `Refill all ${runs.length} to par`}
        </button>
        {error && (
          <p className="w-full text-xs text-state-bad" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Central pick list — load the van once. */}
      {pickList.length > 0 && (
        <div className="mb-3 rounded-card border border-line bg-surface-1 p-5 shadow-e1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
              Pull from the Stockroom
            </h2>
            <span className="tnum text-[11px] text-ink-muted">
              {grandTotal} units total
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Load the van once — everything this run needs, totalled across all units.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            {pickList.map((p) => (
              <li
                key={p.item_name}
                className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0"
              >
                <span className="text-ink-secondary">{p.item_name}</span>
                <span className="tnum flex items-center gap-2">
                  <span className="font-display text-base font-bold text-ink-primary">
                    {p.needed}
                  </span>
                  {p.short ? (
                    <span className="rounded-full border border-[rgba(226,6,2,.35)] bg-red-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-state-bad">
                      Stockroom short {p.needed - p.on_hand}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-muted">
                      {p.on_hand} on hand
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {pickList.some((p) => p.short) && (
            <p className="mt-3 text-xs text-state-bad">
              The Stockroom can&apos;t fully cover the bold items — buy more bulk before the run.
            </p>
          )}
        </div>
      )}

      {/* Linens ride a different track — replaced on loss/damage, not topped up
          weekly — so they're not part of this consumables run. */}
      <p className="mb-5 text-xs text-ink-muted">
        Towels and bedding aren&apos;t in this run — they&apos;re replaced on
        loss or damage from the{" "}
        <a href="/linens" className="text-ink-tertiary underline underline-offset-2 hover:text-ink-secondary">
          Linens
        </a>{" "}
        tab.
      </p>

      {/* Per-property sections — walk the run address by address. */}
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.property}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
                {group.property}
                <span className="ml-2 tnum text-[11px] font-normal text-ink-muted">
                  {group.units.length} {group.units.length === 1 ? "unit" : "units"} · {group.total} to pull
                </span>
              </h2>
              {group.units.length > 1 && (
                <button
                  type="button"
                  onClick={() => restockProperty(group.property, group.units)}
                  disabled={busy}
                  className="min-h-9 rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 font-display text-xs font-bold text-ink-secondary transition duration-150 ease-out hover:border-red hover:text-ink-primary active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyProperty === group.property
                    ? "Refilling…"
                    : `Refill all ${group.units.length} here`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {group.units.map((run) => {
                const total = run.items.reduce((s, i) => s + i.needed, 0);
                return (
                  <div
                    key={run.unit_id}
                    className="rounded-card border border-line bg-surface-2 p-5 shadow-e1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-display text-base font-bold text-ink-primary">
                          {run.unit_name}
                        </div>
                        <div className="tnum text-[11px] text-ink-muted">
                          {run.items.length} {run.items.length === 1 ? "item" : "items"} · {total} units to pull
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => complete(run)}
                        disabled={busy}
                        className="min-h-10 shrink-0 rounded-control border border-line-strong bg-surface-3 px-3.5 py-2 font-display text-xs font-bold text-ink-primary transition duration-150 ease-out hover:border-red active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === run.unit_id ? "Restocking…" : "Refill to par"}
                      </button>
                    </div>

                    <ul className="mt-3 divide-y divide-[rgba(112,113,118,.14)]">
                      {run.items.map((i) => {
                        const short = shortSet.has(i.item_name);
                        return (
                          <li
                            key={i.item_name}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <span className="flex items-center gap-2 text-ink-secondary">
                              {i.item_name}
                              {short && (
                                <span className="rounded-full border border-[rgba(226,6,2,.35)] bg-red-subtle px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-state-bad">
                                  Stockroom short
                                </span>
                              )}
                            </span>
                            <span className="tnum text-ink-tertiary">
                              <span className="font-bold text-state-warn">+{i.needed}</span>
                              <span className="ml-2 text-ink-muted">
                                {i.current_actual} → {i.closet_par}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
