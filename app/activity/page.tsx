import { listStockAudit } from "@/lib/inventory";
import { Container, EmptyState, PageHeader, SetupNotice, formatWhen } from "@/app/components/ui";
import type { StockAuditEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// View — admin audit trail of manual stock changes (counts, targets, linen edits).
export default async function ActivityPage() {
  let rows: StockAuditEntry[] = [];
  let loadError: string | null = null;
  try {
    rows = await listStockAudit();
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <Container>
      <PageHeader eyebrow="Admin" title="Activity">
        {!loadError && rows.length > 0 && (
          <p className="text-sm text-ink-tertiary">
            {rows.length} recent stock {rows.length === 1 ? "change" : "changes"}
          </p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : rows.length === 0 ? (
        <EmptyState punch="Quiet" line="No stock changes have been logged yet." />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 ${
                idx > 0 ? "border-t border-line" : ""
              }`}
            >
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.05em] text-ink-secondary">
                {r.action}
              </span>
              <span className="text-sm text-ink-primary">
                {r.item}
                {r.unit_name ? (
                  <span className="text-ink-tertiary"> · {r.unit_name}</span>
                ) : null}
              </span>
              {r.detail && (
                <span className="tnum text-sm text-ink-tertiary">{r.detail}</span>
              )}
              <span className="ml-auto whitespace-nowrap text-[11px] text-ink-muted">
                {r.actor} · {formatWhen(r.at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
