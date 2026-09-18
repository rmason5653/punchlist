import { redirect } from "next/navigation";
import { queryPullLog } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { Container, PageHeader, SetupNotice } from "@/app/components/ui";
import type { PullLogEntry } from "@/lib/types";
import { parseLogParams } from "@/lib/log-filters";
import LogClient, { PAGE_SIZE } from "./LogClient";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Managers only. Middleware gates the path; this is the second lock.
  if (!(await isAdmin())) redirect("/");

  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const filters = parseLogParams(flat);
  const filtered = !!(filters.q || filters.from || filters.to);

  let entries: PullLogEntry[] = [];
  let loadError: string | null = null;
  try {
    entries = await queryPullLog({ ...filters, limit: PAGE_SIZE });
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <Container>
      <PageHeader eyebrow="Audit trail · managers" title="Stockroom pull log">
        {!loadError && (
          <p className="text-sm text-ink-tertiary">
            {filtered ? "Filtered · " : ""}
            {entries.length === PAGE_SIZE ? `${PAGE_SIZE}+` : entries.length}{" "}
            {entries.length === 1 ? "movement" : "movements"}
          </p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : (
        <LogClient
          initial={entries}
          initialMore={entries.length === PAGE_SIZE}
          q={flat.q ?? ""}
          from={flat.from ?? ""}
          to={flat.to ?? ""}
        />
      )}
    </Container>
  );
}
