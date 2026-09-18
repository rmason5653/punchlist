"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatWhen } from "@/app/components/ui";
import { useToast } from "@/app/components/Toast";
import type { ParkingStatus } from "@/lib/types";

interface ParkingUnit {
  unit_id: string;
  name: string;
  parking_pass_label: string;
  parking_status: ParkingStatus;
  parking_confirmed_at: string | null;
}

/**
 * One row per unit with a pass. The control *is* the status: a segmented
 * Present | Missing that shows which side is current, in place of a pill
 * plus two always-live buttons that said the same thing three ways.
 */
export default function ParkingClient({ units }: { units: ParkingUnit[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(u: ParkingUnit, status: "ok" | "missing") {
    if (u.parking_status === status) return;
    setBusyId(u.unit_id);
    setError("");
    try {
      const res = await fetch(`/api/units/${u.unit_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parking_status: status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not update.");
      }
      toast(`${u.name}: pass marked ${status === "ok" ? "present" : "missing"}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (units.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface-2 p-8 text-center text-sm text-ink-tertiary">
        No unit has a parking pass to track.
      </p>
    );
  }

  const seg = (on: boolean, tone: "ok" | "bad") =>
    `min-h-9 flex-1 rounded-[4px] px-3 font-display text-xs font-bold transition disabled:opacity-60 sm:flex-none sm:px-4 ${
      on
        ? tone === "ok"
          ? "bg-green-subtle text-state-ok shadow-e1"
          : "bg-red-subtle text-state-bad shadow-e1"
        : "text-ink-tertiary hover:text-ink-primary"
    }`;

  return (
    <section>
      {error && (
        <p className="mb-3 text-sm text-state-bad" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
        {units.map((u, idx) => {
          const missing = u.parking_status === "missing";
          const busy = busyId === u.unit_id;
          return (
            <div
              key={u.unit_id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${
                idx > 0 ? "border-t border-line" : ""
              }`}
            >
              {/* Phone: name and meta take the first line, the control the second. */}
              <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                <div className="text-sm font-medium text-ink-primary">{u.name}</div>
                <div className={`text-[11px] ${missing ? "text-state-bad" : "text-ink-muted"}`}>
                  {u.parking_pass_label} ·{" "}
                  {missing
                    ? "flagged missing"
                    : `confirmed ${formatWhen(u.parking_confirmed_at)}`}
                </div>
              </div>

              <div
                role="group"
                aria-label={`${u.name} parking pass`}
                className="flex w-full gap-0.5 rounded-control border border-line bg-surface-1 p-0.5 sm:w-auto"
              >
                <button
                  type="button"
                  onClick={() => setStatus(u, "ok")}
                  aria-pressed={!missing}
                  disabled={busy}
                  className={seg(!missing, "ok")}
                >
                  Present
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(u, "missing")}
                  aria-pressed={missing}
                  disabled={busy}
                  className={seg(missing, "bad")}
                >
                  Missing
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
