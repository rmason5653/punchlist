import { dayEndISO, dayStartISO } from "./time";

/** Turns the pull log's ?q=&from=&to= into a query. Dates are the team's
 *  days, not UTC's. Lives here (not in the route file) because Next only
 *  allows handler exports from a route module. */
export function parseLogParams(
  p: URLSearchParams | Record<string, string | undefined>,
) {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : p[k]) ?? "";
  return {
    q: get("q").slice(0, 80),
    from: dayStartISO(get("from")) ?? undefined,
    to: dayEndISO(get("to")) ?? undefined,
  };
}
