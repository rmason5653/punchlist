import { Container } from "@/app/components/ui";

// Shaped like the page: a header, then building sections of rows.
export default function Loading() {
  return (
    <Container>
      <div className="mb-6 space-y-2">
        <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
        <div className="h-9 w-56 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="mb-6 h-4 w-full max-w-xl animate-pulse rounded bg-surface-2" />
      <div className="space-y-8">
        {[4, 6, 3].map((n, i) => (
          <div key={i}>
            <div className="mb-3 h-4 w-32 animate-pulse rounded bg-surface-2" />
            <div className="overflow-hidden rounded-card border border-line bg-surface-2">
              {Array.from({ length: n }).map((_, j) => (
                <div
                  key={j}
                  className={`h-11 animate-pulse bg-surface-3 ${j > 0 ? "border-t border-line" : ""}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
