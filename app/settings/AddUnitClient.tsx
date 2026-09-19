"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatWhen } from "@/app/components/ui";
import { useToast } from "@/app/components/Toast";

const PARKING = ["None", "1 pass", "2 passes", "Card"];

/**
 * Add a unit without a SQL editor: name, building, bedrooms (which picks the
 * linen profile), parking, bagged bedding, Hostaway id. The API creates the
 * closet and linen rows and recalculates par. Retired units can come back
 * from here.
 */
export default function AddUnitClient({
  buildings,
  retired,
}: {
  buildings: string[];
  retired: { unit_id: string; name: string; retired_at: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [bedrooms, setBedrooms] = useState<1 | 2>(1);
  const [parking, setParking] = useState("None");
  const [pullout, setPullout] = useState(false);
  const [rollaways, setRollaways] = useState("0");
  const [hid, setHid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setBuilding("");
    setBedrooms(1);
    setParking("None");
    setPullout(false);
    setRollaways("0");
    setHid("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          property_name: building,
          bedrooms,
          parking_pass_label: parking,
          has_pullout: pullout,
          rollaway_beds: Number(rollaways),
          hostaway_listing_id: hid,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not add the unit.");
      toast(`${d.name} added — closet and linens at par`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(u: { unit_id: string; name: string }) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/units/${u.unit_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retired: false }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not restore.");
      }
      toast(`${u.name} is back in the portfolio`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "min-h-11 w-full rounded-control border border-line-strong bg-surface-3 px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-red";
  const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary";
  const ghost =
    "min-h-10 rounded-control border border-line-strong bg-surface-3 px-3.5 font-display text-xs font-bold text-ink-primary transition hover:border-red active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-ink-tertiary">
        A new unit gets the standard closet of consumables, a linen set for its
        bedrooms, and par from the settings above. Tune its linens on the unit
        page afterwards.
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={ghost}>
          Add a unit
        </button>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-card border border-line bg-surface-2 p-4 shadow-e1"
          aria-label="Add a unit"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-unit-name" className={label}>
                Unit name
              </label>
              <input
                id="new-unit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Waites 401"
                required
                autoFocus
                className={input}
              />
            </div>
            <div>
              <label htmlFor="new-unit-building" className={label}>
                Building
              </label>
              <input
                id="new-unit-building"
                list="new-unit-buildings"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. Waites"
                required
                className={input}
              />
              <datalist id="new-unit-buildings">
                {buildings.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <span className={label}>Bedrooms</span>
              <div
                role="group"
                aria-label="Bedrooms"
                className="inline-flex rounded-control border border-line-strong bg-surface-3 p-0.5"
              >
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBedrooms(n)}
                    aria-pressed={bedrooms === n}
                    className={`min-h-10 rounded-[6px] px-4 text-sm font-semibold transition ${
                      bedrooms === n ? "bg-surface-4 text-ink-primary shadow-e1" : "text-ink-tertiary hover:text-ink-primary"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-ink-muted">
                {bedrooms === 1 ? "King set, like Citizen." : "Queen + king sets, like Art House."}
              </p>
            </div>
            <div>
              <label htmlFor="new-unit-parking" className={label}>
                Parking pass
              </label>
              <select
                id="new-unit-parking"
                value={parking}
                onChange={(e) => setParking(e.target.value)}
                className={input}
              >
                {PARKING.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-unit-hid" className={label}>
                Hostaway listing id
              </label>
              <input
                id="new-unit-hid"
                inputMode="numeric"
                value={hid}
                onChange={(e) => setHid(e.target.value)}
                placeholder="optional"
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex min-h-10 items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={pullout}
                onChange={(e) => setPullout(e.target.checked)}
                className="h-4 w-4 accent-[rgb(226,6,2)]"
              />
              Queen pullout couch
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm text-ink-secondary">
              Twin rollaways
              <input
                inputMode="numeric"
                value={rollaways}
                onChange={(e) => setRollaways(e.target.value)}
                aria-label="Twin rollaways"
                className="tnum min-h-10 w-16 rounded-control border border-line-strong bg-surface-3 px-3 text-sm text-ink-primary outline-none focus:border-red"
              />
            </label>
          </div>

          {error && (
            <p className="text-sm text-state-bad" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy || !name.trim() || !building.trim()}
              className="min-h-10 rounded-control bg-red px-4 font-display text-sm font-bold text-bone transition hover:bg-red-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add unit"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="min-h-10 px-2 text-sm text-ink-tertiary hover:text-ink-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {retired.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-secondary">
            Retired
          </h3>
          <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
            {retired.map((u, idx) => (
              <div
                key={u.unit_id}
                className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                  idx > 0 ? "border-t border-line" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="font-medium text-ink-primary">{u.name}</span>
                  <span className="ml-2 tnum text-xs text-ink-muted">retired {formatWhen(u.retired_at)}</span>
                </span>
                <button type="button" onClick={() => restore(u)} disabled={busy} className={ghost}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
