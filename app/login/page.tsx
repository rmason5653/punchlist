"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("e") === "set")
      setNotice("Your account is set up — log in with your email and password.");
    if (p.get("e") === "invite")
      setError("That link isn't valid anymore. Ask your manager for a new one.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Wrong email or password.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-2 w-full rounded-control border border-line-strong bg-surface-3 px-3 py-2.5 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-red";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-modal border border-line bg-surface-2 p-8 shadow-e2"
      >
        <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
          Mason Homes
        </p>
        <h1 className="mt-1 font-punch text-5xl uppercase leading-none tracking-[0.02em] text-ink-primary">
          Par
        </h1>
        <p className="mt-3 text-sm text-ink-tertiary">
          Log in with your email and password.
        </p>
        {notice && <p className="mt-2 text-sm text-state-ok">{notice}</p>}

        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
          inputMode="email"
          className={field}
        />
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            className={`${field} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-pressed={showPw}
            className="absolute right-2 top-1/2 mt-1 -translate-y-1/2 rounded-control px-2 py-1 text-xs font-semibold text-ink-tertiary hover:text-ink-primary"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-state-bad" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-control bg-red px-3 py-2.5 font-display text-sm font-bold text-bone transition duration-150 ease-out hover:bg-red-hover active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
        <p className="mt-4 text-center text-xs text-ink-muted">
          Forgot it? Ask your manager to reset your password.
        </p>
        <p className="mt-6 text-center text-xs italic text-steel">
          Built loud. Built heavy. Built to last.
        </p>
      </form>
    </main>
  );
}
