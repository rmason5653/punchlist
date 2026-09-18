import { redirect } from "next/navigation";
import { listPullLog } from "@/lib/inventory";
import { isAdmin } from "@/lib/auth-context";
import { Container, PageHeader, SetupNotice } from "@/app/components/ui";
import type { PullLogEntry } from "@/lib/types";
import LogClient from "./LogClient";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  // Managers only. Middleware gates the path; this is the second lock.
  if (!(await isAdmin())) redirect("/");

  let entries: PullLogEntry[] = [];
  let loadError: string | null = null;

  try {
    entries = await listPullLog(300);
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <Container>
      <PageHeader eyebrow="View 4" title="Stockroom pull log">
        {!loadError && (
          <p className="text-sm text-ink-tertiary">{entries.length} movements</p>
        )}
      </PageHeader>

      {loadError ? (
        <SetupNotice message={loadError} />
      ) : (
        <LogClient entries={entries} />
      )}
    </Container>
  );
}
