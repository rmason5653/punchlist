import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth-context";
import { friendlyError } from "@/lib/errors";
import { queryPullLog } from "@/lib/inventory";
import { linenLabel, reasonLabel } from "@/lib/constants";
import { formatWhen } from "@/app/components/ui";
import { parseLogParams } from "@/lib/log-filters";

export const dynamic = "force-dynamic";

// The pull log as JSON (paged, for "Load more") or as a CSV download of
// everything that matches. Managers only.
export async function GET(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const url = new URL(req.url);
  const base = parseLogParams(url.searchParams);
  const csv = url.searchParams.get("format") === "csv";

  try {
    if (csv) {
      const rows = await queryPullLog({ ...base, limit: 5000 });
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [
        ["When", "Item", "Category", "Qty", "Destination", "Reason", "By"].map(esc).join(","),
        ...rows.map((r) =>
          [
            formatWhen(r.pulled_at),
            r.category === "linen" ? linenLabel(r.item_name) : r.item_name,
            r.category,
            r.quantity,
            r.destination_name ?? "",
            reasonLabel(r.reason),
            r.staff_name,
          ].map(esc).join(","),
        ),
      ];
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="par-pull-log-${stamp}.csv"`,
        },
      });
    }
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100) || 100, 1), 500);
    const rows = await queryPullLog({ ...base, offset, limit });
    return NextResponse.json({ rows, more: rows.length === limit });
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
