import { BUSINESS_TZ } from "./constants";

// Day boundaries in the team's zone. A date picked as "Sep 17" means the
// team's Sep 17, not UTC's — the offset for that particular day is looked
// up so DST comes out right.

function offsetMinutes(at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TZ, timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** ISO instant for 00:00 of the given YYYY-MM-DD in the business zone. */
export function dayStartISO(ymd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const guess = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  return new Date(guess.getTime() - offsetMinutes(guess) * 60_000).toISOString();
}

/** ISO instant for the last millisecond of the given YYYY-MM-DD. */
export function dayEndISO(ymd: string): string | null {
  const start = dayStartISO(ymd);
  if (!start) return null;
  return new Date(new Date(start).getTime() + 86_400_000 - 1).toISOString();
}
