"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/app/components/ui";

// Catches anything a page throws while rendering. The team sees one calm
// message and a way back; the detail goes to the console for whoever is
// debugging.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[par]", error);
  }, [error]);

  return (
    <Container>
      <div className="rounded-card border border-[rgba(226,6,2,.35)] bg-red-subtle p-5 text-sm text-ink-secondary">
        <p className="font-display font-bold text-ink-primary">
          Par couldn&apos;t load this page
        </p>
        <p className="mt-1">Give it a moment and try again. If it keeps happening, tell a manager.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-control bg-red px-3 py-1.5 font-display text-xs font-bold text-bone transition hover:bg-red-hover"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 font-display text-xs font-bold text-ink-primary transition hover:border-red"
          >
            Back to all units
          </Link>
        </div>
        {process.env.NODE_ENV === "development" && (
          <p className="mono mt-3 text-xs text-ink-tertiary">{error.message}</p>
        )}
      </div>
    </Container>
  );
}
