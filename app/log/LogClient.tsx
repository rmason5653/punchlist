"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { linenLabel, reasonLabel } from "@/lib/constants";
import type { PullLogEntry } from "@/lib/types";
import { Pill, formatWhen } from "@/app/components/ui";

export const PAGE_SIZE = 100;

type Tab = "all" | "weekly_restock" | "exceptions";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "weekly_restock", label: "Restock" },
  { key: "exceptions", label: "Linen exceptions" },
];

function itemLabel(e: PullLogEntry) {
  return e.category === "linen" ? linenLabel(e.item_name) : e.item_name;
}

/**
 * The audit trail. Search, date range and paging run on the server (the
 * filters live in the URL so a view can be shared); the three tabs are a
 * quick client-side slice of what's loaded.
 */
export default function LogClient({
  initial,
  initialMore,
  q,
  from,
  to,
}: {
  initial: PullLogEntry[];
  initialMore: boolean;
  q: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState(initial);
  const [more, setMore] = useState(initialMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A fresh server render (new filters) replaces the list.
  useEffect(() => {
    setRows(initial);
    setMore(initialMore);
  }, [initial, initialMore]);

  const params = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p;
  };

  function navigate(next: { q?: string; from?: string; to?: string }) {
    const p = new URLSearchParams();
    const nq = next.q ?? q, nf = next.from ?? from, nt = next.to ?? to;
    if (nq) p.set("q", nq);
    if (nf) p.set("from", nf);
    if (nt) p.set("to", nt);
    router.push(`/log${p.toString() ? `?${p}` : ""}`);
  }

  function onSearch(v: string) {
    setSearch(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => navigate({ q: v.trim() }), 350);
  }

  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/log?${params({ offset: String(rows.length), limit: String(PAGE_SIZE) })}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't load more.");
      setRows((r) => [...r, ...(d.rows as PullLogEntry[])]);
      setMore(!!d.more);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const visible = rows.filter((e) => {
    if (tab === "all") return true;
    if (tab === "weekly_restock") return e.reason === "weekly_restock";
    return e.reason !== "weekly_restock";
  });

  const field =
    "min-h-9 rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-red";
  const filtered = !!(q || from || to);

  return (
    <div>
      {/* Filters — search, dates, tabs, export. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search item, person, or unit"
          aria-label="Search the pull log"
          className={`${field} min-w-0 flex-1 basis-56`}
        />
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => navigate({ from: e.target.value })}
            aria-label="From date"
            className={`${field} tnum`}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => navigate({ to: e.target.value })}
            aria-label="To date"
            className={`${field} tnum`}
          />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              router.push("/log");
            }}
            className="min-h-9 rounded-control px-2 text-xs font-semibold text-ink-tertiary hover:text-ink-primary"
          >
            Clear
          </button>
        )}
        <a
          href={`/api/log?${params({ format: "csv" })}`}
          className="ml-auto inline-flex min-h-9 items-center rounded-control border border-line-strong bg-surface-3 px-3 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary"
        >
          Download CSV
        </a>
      </div>

      <div className="mb-4 flex gap-1 rounded-control bg-surface-1 p-0.5 text-xs font-medium">
        {TABS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTab(f.key)}
            aria-pressed={tab === f.key}
            className={`min-h-9 rounded-[4px] px-3 transition duration-150 ease-out ${
              tab === f.key
                ? "bg-surface-3 text-ink-primary shadow-e1"
                : "text-ink-tertiary hover:text-ink-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-card border border-line bg-surface-2 p-8 text-center text-sm text-ink-tertiary">
          {filtered ? "Nothing matches those filters." : "No pulls logged yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
          {/* Header (desktop) */}
          <div className="hidden grid-cols-[8rem_1fr_4rem_1fr_9rem] gap-3 border-b border-line px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted sm:grid">
            <span>When</span>
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span>Destination</span>
            <span>Reason</span>
          </div>
          {visible.map((e, idx) => {
            const exception = e.reason !== "weekly_restock";
            return (
              <div key={e.id} className={idx > 0 ? "border-t border-line" : ""}>
                {/* Phone: two lines, the quantity labelled by what follows it. */}
                <div className="px-4 py-3 sm:hidden">
                  <div className="text-sm text-ink-primary">
                    <span className="tnum font-bold">{e.quantity} ×</span>{" "}
                    <span className="font-medium">{itemLabel(e)}</span>
                    {e.destination_name && (
                      <span className="text-ink-secondary"> → {e.destination_name}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    <span>{e.staff_name}</span>
                    <span>·</span>
                    <span className="tnum">{formatWhen(e.pulled_at)}</span>
                    <Pill tone={exception ? "bad" : "neutral"}>{reasonLabel(e.reason)}</Pill>
                  </div>
                </div>
                {/* Desktop: the table row. */}
                <div className="hidden px-4 py-3 text-sm sm:grid sm:grid-cols-[8rem_1fr_4rem_1fr_9rem] sm:items-center sm:gap-3">
                  <div className="tnum text-xs text-ink-muted">{formatWhen(e.pulled_at)}</div>
                  <div className="font-medium text-ink-primary">
                    {itemLabel(e)}
                    <span className="ml-2 text-xs text-ink-muted">by {e.staff_name}</span>
                  </div>
                  <div className="tnum text-right font-bold text-ink-secondary">{e.quantity}</div>
                  <div className="text-ink-secondary">{e.destination_name ?? "—"}</div>
                  <div>
                    <Pill tone={exception ? "bad" : "neutral"}>{reasonLabel(e.reason)}</Pill>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(more || error) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {more && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="min-h-9 rounded-control border border-line-strong bg-surface-3 px-4 font-display text-xs font-bold text-ink-primary transition hover:border-red disabled:opacity-50"
            >
              {loading ? "Loading…" : `Load ${PAGE_SIZE} more`}
            </button>
          )}
          <span className="tnum text-xs text-ink-muted">Showing {rows.length}</span>
          {error && (
            <span className="text-xs text-state-bad" role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
