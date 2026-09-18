"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { linenLabel } from "@/lib/constants";
import { needsRestock } from "@/lib/rules";
import StaffSelect from "@/app/components/StaffSelect";
import { useConfirm } from "@/app/components/ConfirmSheet";
import { useToast } from "@/app/components/Toast";
import { enqueue, isNetworkFailure } from "@/lib/queue";
import type { ConsumablePar, LinenPar, Unit } from "@/lib/types";

const STAFF_KEY = "mason_inv_staff";

export default function CleanFlow({
  unit,
  consumables,
  linens,
  staffNames,
  viewerName,
}: {
  unit: Unit;
  consumables: ConsumablePar[];
  linens: LinenPar[];
  staffNames: string[];
  viewerName: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const [parking, setParking] = useState<"ok" | "missing" | null>(
    unit.has_parking_pass ? (unit.parking_status === "missing" ? "missing" : "ok") : null,
  );

  // Items already below par came flagged from an earlier clean (or were only
  // partly refilled) and are waiting on the restock run. They stay that way —
  // only a manager's refill clears them — so they're shown, not offered as a
  // toggle. Tapping one back to "OK" used to cancel its restock with nothing
  // pulled.
  const alreadyLow = useMemo(
    () => new Set(consumables.filter(needsRestock).map((c) => c.id)),
    [consumables],
  );
  const [low, setLow] = useState<Set<string>>(() => new Set());

  const anyShort = useMemo(
    () => linens.some((l) => l.current_actual < l.par_count),
    [linens],
  );
  // Bagged bedding this unit carries, so the clean flow can name each bag and
  // what a complete one holds. Standing beds are made up and never listed.
  const bags = useMemo(() => {
    const out: { label: string; contents: string }[] = [];
    if (unit.has_pullout) {
      out.push({
        label: "Queen pullout couch",
        contents: "queen sheets, 1 queen quilt, 2 queen pillowcases",
      });
    }
    if (unit.rollaway_beds > 0) {
      out.push({
        label: `${unit.rollaway_beds} twin rollaway${unit.rollaway_beds > 1 ? "s" : ""}`,
        contents: "twin sheets, 1 twin quilt, 1 queen pillowcase — each",
      });
    }
    return out;
  }, [unit.has_pullout, unit.rollaway_beds]);

  const [linensOk, setLinensOk] = useState<boolean>(!anyShort);
  const [linenActual, setLinenActual] = useState<Record<string, number>>(() =>
    Object.fromEntries(linens.map((l) => [l.linen_type, l.current_actual])),
  );

  const [staff, setStaff] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Default to the remembered pick if it's still on the roster, otherwise the
  // logged-in user. Runs once on mount (client-only localStorage read).
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

  function toggleLow(id: string) {
    setLow((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setLinen(type: string, value: number, par: number) {
    setLinenActual((prev) => ({
      ...prev,
      [type]: Math.max(0, Math.min(par, value)),
    }));
  }

  // One line per section, so the person sees what they're about to record.
  function summary(): string {
    const parts: string[] = [];
    if (unit.has_parking_pass) parts.push(parking === "missing" ? "Parking pass missing" : "Parking pass present");
    const flagged = consumables.filter((c) => low.has(c.id)).map((c) => c.item_name);
    parts.push(
      flagged.length === 0
        ? "No new items flagged"
        : `Flagged ${flagged.length}: ${flagged.join(", ")}`,
    );
    if (linensOk) parts.push("Linens all at par");
    else {
      const short = linens
        .filter((l) => (linenActual[l.linen_type] ?? l.par_count) < l.par_count)
        .map((l) => `${linenLabel(l.linen_type)} ${linenActual[l.linen_type] ?? l.par_count}/${l.par_count}`);
      parts.push(short.length ? `Linens short: ${short.join(", ")}` : "Linens all at par");
    }
    parts.push(`Recorded as ${staff.trim() || "—"}`);
    return parts.join(" · ");
  }

  async function complete() {
    const ok = await confirm({
      title: `Record this clean for ${unit.name}?`,
      body: summary(),
      confirmLabel: "Record clean",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    const url = `/api/units/${unit.unit_id}/clean`;
    const payload = {
      staff_name: staff.trim() || undefined,
      parking,
      consumables: consumables.map((c) => ({ id: c.id, low: low.has(c.id) })),
      linens_ok: linensOk,
      linen_flags: linensOk
        ? []
        : linens.map((l) => ({
            linen_type: l.linen_type,
            actual: linenActual[l.linen_type] ?? l.par_count,
          })),
    };
    try {
      if (staff.trim()) localStorage.setItem(STAFF_KEY, staff.trim());
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save the clean.");
      }
      toast(`Clean recorded for ${unit.name}`);
      router.push("/");
      router.refresh();
    } catch (e) {
      // No signal in the unit: keep the record on the phone and send it when
      // the link comes back, rather than making the cleaner stand there.
      if (isNetworkFailure(e)) {
        enqueue({ url, body: payload, label: `Clean for ${unit.name}` });
        toast(`No signal — the clean for ${unit.name} is saved on this phone and will send when you're back online.`, {
          tone: "neutral",
          duration: 8000,
        });
        router.push("/");
        return;
      }
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const section = "rounded-card border border-line bg-surface-2 p-5 shadow-e1";
  const stepBtn =
    "h-11 w-11 shrink-0 rounded-control border border-line-strong bg-surface-3 text-lg font-bold text-ink-secondary transition hover:border-red hover:text-ink-primary active:brightness-95 disabled:opacity-40";
  // Mid-clean, one thumb: 44px minimum on every tap.
  const bigToggle = (on: boolean, tone: "ok" | "bad") =>
    `min-h-11 rounded-control border px-4 py-3 font-display text-sm font-bold transition active:brightness-95 ${
      on
        ? tone === "ok"
          ? "border-[rgba(31,138,76,.5)] bg-green-subtle text-state-ok"
          : "border-[rgba(226,6,2,.5)] bg-red-subtle text-state-bad"
        : "border-line-strong bg-surface-3 text-ink-tertiary hover:text-ink-primary"
    }`;

  return (
    <div className="space-y-4 pb-28">
      {/* 1 — Parking */}
      <section className={section}>
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
          <span className="tnum flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface-3 text-[11px] text-ink-tertiary">
            1
          </span>
          Parking pass
        </h2>
        {unit.has_parking_pass ? (
          <>
            <p className="mt-1 text-xs text-ink-muted">
              {unit.parking_pass_label} — confirm it&apos;s present.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setParking("ok")}
                aria-pressed={parking === "ok"}
                className={bigToggle(parking === "ok", "ok")}
              >
                Present
              </button>
              <button
                type="button"
                onClick={() => setParking("missing")}
                aria-pressed={parking === "missing"}
                className={bigToggle(parking === "missing", "bad")}
              >
                Missing
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-tertiary">
            This unit has no parking pass. Nothing to confirm.
          </p>
        )}
      </section>

      {/* 2 — Consumables */}
      <section className={section}>
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
          <span className="tnum flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface-3 text-[11px] text-ink-tertiary">
            2
          </span>
          Consumables
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Leave the listed amount in the unit. If the closet has its flag number
          or fewer left <em>after</em> that, tap{" "}
          <b className="text-ink-secondary">Needs restock</b>.
        </p>
        <ul className="mt-3 divide-y divide-[rgba(112,113,118,.14)]">
          {consumables.map((c) => {
            const waiting = alreadyLow.has(c.id);
            const flagged = low.has(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-ink-primary">
                    {c.item_name}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {waiting ? (
                      <>Flagged on an earlier clean · on the restock run</>
                    ) : c.fixed_par ? (
                      // Bulk supply (e.g. a gallon of soap) — lives in the
                      // closet; flag when it's about to run out.
                      <>
                        Keep <b className="text-ink-secondary">{c.closet_par}</b>{" "}
                        in the closet · flag when it&apos;s running low
                      </>
                    ) : (
                      <>
                        Leave <b className="text-ink-secondary">{c.leave_behind}</b>{" "}
                        · flag if the closet has {c.reorder_point} or fewer after
                      </>
                    )}
                  </div>
                </div>
                {waiting ? (
                  <span className="shrink-0 rounded-full border border-[rgba(245,184,0,.4)] bg-gold-subtle px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-state-warn">
                    Waiting on restock
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleLow(c.id)}
                    aria-pressed={flagged}
                    className={`min-h-11 w-36 shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.04em] transition active:brightness-95 ${
                      flagged
                        ? "border-[rgba(245,184,0,.4)] bg-gold-subtle text-state-warn"
                        : "border-line-strong bg-surface-3 text-ink-tertiary hover:text-ink-primary"
                    }`}
                  >
                    {flagged ? "Needs restock" : "OK"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3 — Linens */}
      <section className={section}>
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
          <span className="tnum flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface-3 text-[11px] text-ink-tertiary">
            3
          </span>
          Linens
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Counts should match par. Flag anything damaged, stained, or missing.
        </p>
        {bags.length > 0 && (
          <div className="mt-2 rounded-control border border-[rgba(245,184,0,.3)] bg-gold-subtle px-3 py-2 text-xs text-state-warn">
            <p>
              Bedding for {bags.length > 1 ? "these" : "this"} is in a{" "}
              <b>linen bag in the closet</b>, not made up on the bed. Open each
              bag and check inside — a bag that&apos;s there but a piece short is
              still short.
            </p>
            <ul className="mt-1.5 space-y-1">
              {bags.map((b) => (
                <li key={b.label}>
                  <b>{b.label}</b> — {b.contents}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLinensOk(true)}
            aria-pressed={linensOk}
            className={bigToggle(linensOk, "ok")}
          >
            All match par
          </button>
          <button
            type="button"
            onClick={() => setLinensOk(false)}
            aria-pressed={!linensOk}
            className={bigToggle(!linensOk, "bad")}
          >
            Flag an issue
          </button>
        </div>

        {!linensOk && (
          <ul className="mt-4 space-y-2">
            {linens.map((l) => {
              const actual = linenActual[l.linen_type] ?? l.par_count;
              const short = actual < l.par_count;
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-control bg-surface-1 px-3 py-2"
                >
                  <div className="text-sm text-ink-primary">
                    {linenLabel(l.linen_type)}
                    <span className="tnum ml-2 text-[11px] text-ink-muted">
                      par {l.par_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={stepBtn}
                      onClick={() => setLinen(l.linen_type, actual - 1, l.par_count)}
                      disabled={actual <= 0}
                      aria-label={`Decrease ${linenLabel(l.linen_type)}`}
                    >
                      −
                    </button>
                    <span
                      className={`tnum w-7 text-center text-sm font-bold ${
                        short ? "text-state-bad" : "text-ink-primary"
                      }`}
                    >
                      {actual}
                    </span>
                    <button
                      type="button"
                      className={stepBtn}
                      onClick={() => setLinen(l.linen_type, actual + 1, l.par_count)}
                      disabled={actual >= l.par_count}
                      aria-label={`Increase ${linenLabel(l.linen_type)}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
            <p className="text-[11px] text-ink-muted">
              A short count flags this unit for loss. A manager replaces it from
              the Stockroom with a logged pull.
            </p>
          </ul>
        )}
      </section>

      {/* Sticky complete bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-4/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-[8px]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <StaffSelect
            value={staff}
            onChange={setStaff}
            names={staffNames}
            className="min-h-11 w-32 shrink-0 rounded-control border border-line-strong bg-surface-3 px-3 py-2.5 text-sm text-ink-primary outline-none focus:border-red sm:w-40"
          />
          {error && (
            <p className="flex-1 truncate text-xs text-state-bad" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={complete}
            disabled={busy}
            className="ml-auto min-h-11 rounded-control bg-red px-5 py-2.5 font-display text-sm font-bold text-bone transition duration-150 ease-out hover:bg-red-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark clean complete"}
          </button>
        </div>
      </div>
    </div>
  );
}
