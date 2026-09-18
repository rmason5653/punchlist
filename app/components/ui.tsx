import Link from "next/link";
import type { ReactNode } from "react";
import { BUSINESS_TZ } from "@/lib/constants";

// Shared presentational pieces for the Mason v4 surface. Pure/server-safe.

export type Tone = "ok" | "warn" | "bad" | "neutral";

const PILL_TONE: Record<Tone, string> = {
  // ok = at par (Mason Green), warn = needs attention/restock (gold),
  // bad = loss / missing (red), neutral = no-direction meta (steel).
  ok: "bg-green-subtle text-state-ok border border-[rgba(31,138,76,.35)]",
  warn: "bg-gold-subtle text-state-warn border border-[rgba(245,184,0,.30)]",
  bad: "bg-red-subtle text-state-bad border border-[rgba(226,6,2,.35)]",
  neutral: "bg-surface-3 text-ink-tertiary border border-line",
};

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] ${PILL_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const STAT_TONE: Record<Tone, string> = {
  ok: "text-state-ok",
  warn: "text-state-warn",
  bad: "text-state-bad",
  neutral: "text-ink-primary",
};

/** A KPI block. Links somewhere when href is given. */
export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
        {label}
      </div>
      <div
        className={`tnum mt-2 font-display text-4xl font-extrabold tracking-[-0.03em] ${STAT_TONE[tone]}`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </>
  );
  const base =
    "block rounded-card border border-line bg-surface-2 p-5 shadow-e1";
  if (href) {
    return (
      <Link
        href={href}
        className={`${base} transition duration-150 ease-out hover:-translate-y-px hover:border-line-strong hover:bg-surface-3 hover:shadow-e2`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}

const BAR_TONE: Record<Tone, string> = {
  ok: "bg-green",
  warn: "bg-gold",
  bad: "bg-red",
  neutral: "bg-steel",
};

/** Thin actual-vs-par bar. */
export function ParBar({
  actual,
  par,
  tone = "neutral",
}: {
  actual: number;
  par: number;
  tone?: Tone;
}) {
  const pct = par > 0 ? Math.max(0, Math.min(100, (actual / par) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={`h-full rounded-full ${BAR_TONE[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-primary">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

/** Page width container. */
export function Container({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </main>
  );
}

export function EmptyState({
  punch,
  line,
}: {
  punch: string;
  line: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-2 p-12 text-center shadow-e1">
      {/* Milestone moment — display punch (American Captain), used sparingly. */}
      <p className="font-punch text-4xl uppercase tracking-[0.02em] text-state-ok">
        {punch}
      </p>
      <p className="mt-2 text-sm text-ink-tertiary">{line}</p>
    </div>
  );
}

/** Banner shown when Supabase is not configured / a read failed. */
export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-[rgba(226,6,2,.35)] bg-red-subtle p-5 text-sm text-ink-secondary">
      <p className="font-display font-bold text-ink-primary">Can&apos;t reach the database</p>
      <p className="mt-1">{message}</p>
      <p className="mt-3 text-ink-tertiary">
        Set <code className="text-ink-secondary">SUPABASE_URL</code> and{" "}
        <code className="text-ink-secondary">SUPABASE_SERVICE_ROLE_KEY</code>, then
        run <code className="text-ink-secondary">supabase/schema.sql</code>.
      </p>
    </div>
  );
}

/** Compact timestamp for logs and confirmations, in the team's zone. Same
 *  text on the server and in the browser, so it never causes a hydration
 *  mismatch. */
export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: BUSINESS_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
