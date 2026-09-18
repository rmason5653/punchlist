// What a failed request tells the person on the screen. The real error goes
// to the server log; the screen gets one calm sentence — unless we're in
// development, where the raw message is the useful thing.
export function friendlyError(
  err: unknown,
  fallback = "Couldn't save that. Give it a moment and try again.",
): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[par]", msg);
  return process.env.NODE_ENV === "development" ? msg : fallback;
}
