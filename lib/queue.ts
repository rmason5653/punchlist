// A clean recorded with no signal waits on the phone and goes when the link
// is back. Browser-only; nothing here runs on the server.

const KEY = "par_queue";
/** Fired on window whenever the queue changes, so the banner can update. */
export const QUEUE_EVENT = "par:queue";

export interface QueuedRequest {
  id: string;
  url: string;
  body: unknown;
  /** What to call it in a toast: "Clean for Citizen 305". */
  label: string;
  at: string;
}

export function readQueue(): QueuedRequest[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedRequest[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    /* storage unavailable — nothing to do */
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function enqueue(item: Omit<QueuedRequest, "id" | "at">): QueuedRequest {
  const full: QueuedRequest = {
    ...item,
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now() + Math.random()),
    at: new Date().toISOString(),
  };
  writeQueue([...readQueue(), full]);
  return full;
}

/** A fetch that threw (rather than answered) with the network down. */
export function isNetworkFailure(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return e instanceof TypeError; // fetch's "Failed to fetch"
}

/**
 * Sends everything waiting. A request the server answers with a 4xx is
 * dropped and reported (it would never succeed); a 5xx or another network
 * failure keeps it for the next try.
 */
export async function flushQueue(): Promise<{ sent: QueuedRequest[]; failed: QueuedRequest[] }> {
  const sent: QueuedRequest[] = [];
  const failed: QueuedRequest[] = [];
  const keep: QueuedRequest[] = [];
  for (const item of readQueue()) {
    try {
      const res = await fetch(item.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (res.ok) sent.push(item);
      else if (res.status >= 400 && res.status < 500) failed.push(item);
      else keep.push(item);
    } catch {
      keep.push(item);
    }
  }
  writeQueue(keep);
  return { sent, failed };
}
