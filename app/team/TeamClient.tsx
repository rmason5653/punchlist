"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser } from "@/lib/types";
import { Pill } from "@/app/components/ui";
import { useConfirm } from "@/app/components/ConfirmSheet";
import { useToast } from "@/app/components/Toast";

export default function TeamClient({ users }: { users: AppUser[] }) {
  const router = useRouter();
  const confirmSheet = useConfirm();
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"cleaner" | "admin">("cleaner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  function linkFor(u: AppUser) {
    return `${origin}/join/${u.invite_token}`;
  }
  function inviteText(u: AppUser) {
    return `You're set up on Mason Homes Par (our inventory app). Tap to create your password and log in: ${linkFor(u)}`;
  }

  async function add() {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add.");
      const e = email.trim();
      setName("");
      setPhone("");
      setEmail("");
      setRole("cleaner");
      if (e) {
        setStatus(
          data.emailed
            ? `Invite emailed to ${e}.`
            : `Added — email didn't send (${data.emailError || "email not set up yet"}). Send their link below.`,
        );
      } else {
        setStatus("Added — send them their link below.");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail(u: AppUser) {
    setError("");
    setStatus("");
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ send_email: true }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "Email failed.");
      return;
    }
    setStatus(`Emailed ${u.name}.`);
  }

  async function patch(id: string, body: Record<string, unknown>, done?: string) {
    setError("");
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Update failed.");
      return;
    }
    if (done) {
      setStatus(done);
      toast(done);
    }
    router.refresh();
  }

  async function changeRole(u: AppUser) {
    if (u.role === "cleaner") {
      const ok = await confirmSheet({
        title: `Make ${u.name} an admin?`,
        body: "Admins see everything and can change stock, targets, and the team.",
        confirmLabel: "Make admin",
      });
      if (!ok) return;
      await patch(u.id, { role: "admin" }, `${u.name} is now an admin.`);
    } else {
      await patch(u.id, { role: "cleaner" }, `${u.name} is now a cleaner.`);
    }
  }

  async function resetPassword(u: AppUser) {
    const ok = await confirmSheet({
      title: `Reset ${u.name}'s password?`,
      body: "Their current password stops working right away. They'll set a new one from a fresh link — send it to them after.",
      confirmLabel: "Reset password",
      danger: true,
    });
    if (!ok) return;
    await patch(u.id, { reset_password: true }, `Password cleared — send ${u.name} their new link.`);
  }

  function startEdit(u: AppUser) {
    setEditingId(u.id);
    setEditName(u.name);
    setEditPhone(u.phone ?? "");
    setEditEmail(u.email ?? "");
    setError("");
    setStatus("");
  }

  async function saveEdit(u: AppUser) {
    if (!editName.trim()) {
      setError("Name can't be empty.");
      return;
    }
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Update failed.");
      return;
    }
    setEditingId(null);
    setError("");
    setStatus(`Updated ${editName.trim()}.`);
    router.refresh();
  }

  async function remove(u: AppUser) {
    const ok = await confirmSheet({
      title: `Remove ${u.name} from the team?`,
      body: "Their login stops working. This can't be undone — disable them instead if they might be back.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setError("");
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Remove failed.");
      return;
    }
    toast(`Removed ${u.name}`);
    router.refresh();
  }

  async function copy(u: AppUser) {
    try {
      await navigator.clipboard.writeText(linkFor(u));
      setCopied(u.id);
      setTimeout(() => setCopied((c) => (c === u.id ? null : c)), 1500);
    } catch {
      setError("Couldn't copy — long-press the link instead.");
    }
  }

  const field =
    "rounded-control border border-line-strong bg-surface-3 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-red";
  const actionBtn =
    "rounded-control border border-line-strong bg-surface-3 px-2.5 py-1 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary";

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-ink-tertiary">
        Add anyone on your team. They get a one-time setup link you send by text
        or email — they tap it, pick a password, and from then on log in with
        their email and password on any device.{" "}
        <b className="text-ink-secondary">Admins</b> see everything;{" "}
        <b className="text-ink-secondary">cleaners</b> get the focused unit view.
      </p>

      {/* Add */}
      <div className="rounded-card border border-line bg-surface-2 p-4 shadow-e1">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className={`${field} min-w-[10rem] flex-1`}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            inputMode="tel"
            className={`${field} min-w-[9rem] flex-1`}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (auto-sends the link)"
            inputMode="email"
            className={`${field} min-w-[9rem] flex-1`}
          />
          <div className="flex rounded-control bg-surface-1 p-0.5 text-xs font-medium">
            {(["cleaner", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`rounded-[4px] px-3 py-1.5 capitalize transition ${
                  role === r
                    ? "bg-surface-4 text-ink-primary shadow-e1"
                    : "text-ink-tertiary hover:text-ink-secondary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="rounded-control bg-red px-4 py-2 font-display text-sm font-bold text-bone transition hover:bg-red-hover active:brightness-95 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-state-bad" role="alert">
            {error}
          </p>
        )}
        {status && !error && (
          <p className="mt-2 text-sm text-state-ok">{status}</p>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className="rounded-card border border-line bg-surface-2 p-4 shadow-e1"
          >
            {editingId === u.id ? (
              /* Edit mode — change name, phone, email. */
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                    className={`${field} min-w-[10rem] flex-1`}
                  />
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    inputMode="tel"
                    className={`${field} min-w-[9rem] flex-1`}
                  />
                  <input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email (optional)"
                    inputMode="email"
                    className={`${field} min-w-[9rem] flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(u)}
                    className="rounded-control bg-red px-4 py-2 font-display text-sm font-bold text-bone transition hover:bg-red-hover active:brightness-95"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setError("");
                    }}
                    className={actionBtn}
                  >
                    Cancel
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-sm text-state-bad" role="alert">
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-bold text-ink-primary">
                        {u.name}
                      </span>
                      {u.role === "admin" ? (
                        <Pill tone="warn">Admin</Pill>
                      ) : (
                        <Pill tone="neutral">Cleaner</Pill>
                      )}
                      {u.status === "disabled" && <Pill tone="bad">Disabled</Pill>}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {[u.phone, u.email].filter(Boolean).join(" · ") || "no contact"}{" "}
                      ·{" "}
                      {u.password_set
                        ? u.last_login_at
                          ? "active"
                          : "password set"
                        : "setup pending"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => startEdit(u)} className={actionBtn}>
                      Edit
                    </button>
                    <button type="button" onClick={() => copy(u)} className={actionBtn}>
                      {copied === u.id ? "Copied!" : "Copy link"}
                    </button>
                    {u.phone && (
                      <a
                        href={`sms:${u.phone}?&body=${encodeURIComponent(inviteText(u))}`}
                        className={actionBtn}
                      >
                        Text
                      </a>
                    )}
                    {u.email && (
                      <button type="button" onClick={() => sendEmail(u)} className={actionBtn}>
                        Email now
                      </button>
                    )}
                    <button type="button" onClick={() => changeRole(u)} className={actionBtn}>
                      Make {u.role === "admin" ? "cleaner" : "admin"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch(
                          u.id,
                          { status: u.status === "disabled" ? "active" : "disabled" },
                          u.status === "disabled" ? `${u.name} can log in again.` : `${u.name} disabled — they can't log in.`,
                        )
                      }
                      className={actionBtn}
                    >
                      {u.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPassword(u)}
                      className={actionBtn}
                      title="Clear their password and issue a new setup link"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      className="rounded-control border border-[rgba(226,6,2,.35)] bg-red-subtle px-2.5 py-1 text-xs font-semibold text-state-bad transition hover:border-red"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* The link itself, for long-press/copy on mobile. */}
                <div className="mt-2 truncate rounded-control bg-surface-1 px-3 py-1.5 text-[11px] text-ink-muted">
                  {origin ? linkFor(u) : "…"}
                </div>
              </>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-sm text-ink-tertiary">
            No one added yet. Add yourself as an admin first.
          </p>
        )}
      </div>
    </div>
  );
}
