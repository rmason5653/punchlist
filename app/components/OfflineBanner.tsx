"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { QUEUE_EVENT, flushQueue, readQueue } from "@/lib/queue";

// Says when the phone has no signal, and sends any cleans that were recorded
// without one as soon as it comes back. Sits just under the nav.
export default function OfflineBanner() {
  const toast = useToast();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  const flush = useCallback(async () => {
    if (readQueue().length === 0) return;
    const { sent, failed } = await flushQueue();
    setPending(readQueue().length);
    for (const s of sent) toast(`Sent: ${s.label}`);
    for (const f of failed)
      toast(`Couldn't send ${f.label} — please record it again`, { tone: "bad", duration: 10000 });
    if (sent.length) router.refresh();
  }, [toast, router]);

  useEffect(() => {
    setOffline(!navigator.onLine);
    setPending(readQueue().length);
    const onOnline = () => {
      setOffline(false);
      void flush();
    };
    const onOffline = () => setOffline(true);
    const onQueue = () => setPending(readQueue().length);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(QUEUE_EVENT, onQueue);
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(QUEUE_EVENT, onQueue);
    };
  }, [flush]);

  if (!offline && pending === 0) return null;

  return (
    <div
      role="status"
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-b border-[rgba(245,184,0,.3)] bg-gold-subtle px-4 py-2 text-center text-xs font-semibold text-state-warn"
    >
      {offline
        ? "No signal — a clean you record now is saved on this phone and sent when you're back online."
        : `${pending} saved ${pending === 1 ? "clean" : "cleans"} waiting to send…`}
    </div>
  );
}
