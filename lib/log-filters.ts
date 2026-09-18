import { dayEndISO, dayStartISO } from "./time";

/** Rows per page. Lives here, not in the client component: a constant
 *  exported from a "use client" module reaches a server component as a
 *  client-reference proxy, not a number — the page's limit became NaN and
 *  the log rendered empty. */
export const LOG_PAGE_SIZE = 100;

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
