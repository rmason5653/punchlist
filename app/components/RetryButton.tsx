"use client";

// A plain reload. Used by the load-failure notice, which is otherwise a
// server component.
export default function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-3 rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 font-display text-xs font-bold text-ink-primary transition hover:border-red"
    >
      Try again
    </button>
  );
}
