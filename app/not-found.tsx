import Link from "next/link";
import { Container } from "@/app/components/ui";

// A stale link — an old Slack message, a unit that was renamed. Say so and
// point back to the list, instead of the framework's unbranded page.
export default function NotFound() {
  return (
    <Container>
      <div className="rounded-card border border-line bg-surface-2 p-12 text-center shadow-e1">
        <p className="font-punch text-5xl uppercase tracking-[0.02em] text-ink-primary">
          Not here
        </p>
        <p className="mt-2 text-sm text-ink-tertiary">
          That page or unit isn&apos;t in Par. The link may be out of date.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-control bg-red px-4 py-2 font-display text-sm font-bold text-bone transition hover:bg-red-hover"
        >
          Back to all units
        </Link>
      </div>
    </Container>
  );
}
