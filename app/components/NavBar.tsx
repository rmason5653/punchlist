"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PULL_TRIGGER, PullModal } from "./PullDialog";
import ThemeToggle from "./ThemeToggle";

// admin: only managers/owner see it; cleaners get the focused set.
// more: kept off the main bar (under "More") so the daily-use tabs stay short.
// moreForAdmin: on the bar for cleaners (it's one of their two tabs), under
// More for managers, who have the audit trail there instead.
const LINKS = [
  { href: "/", label: "Home", admin: false, more: false },
  { href: "/restock", label: "Restock", admin: true, more: false },
  { href: "/central", label: "Stockroom", admin: true, more: false },
  { href: "/linens", label: "Linens", admin: true, more: false },
  { href: "/log", label: "Pull log", admin: true, more: false },
  { href: "/guide", label: "Guide", admin: false, more: false, moreForAdmin: true },
  { href: "/activity", label: "Activity", admin: true, more: true },
  { href: "/parking", label: "Parking", admin: true, more: true },
  { href: "/transition", label: "Transition", admin: true, more: true },
  { href: "/team", label: "Team", admin: true, more: true },
  { href: "/settings", label: "Settings", admin: true, more: true },
];

export default function NavBar({
  isAdmin,
  viewerName,
}: {
  isAdmin: boolean;
  viewerName: string;
}) {
  // Who's logged in, on every screen — attribution is the point of per-person
  // logins, and a shared phone otherwise credits the wrong name.
  const initials = viewerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // The pull modal is owned here, not by the menu that holds its button: the
  // phone menu unmounts when it closes, and a modal living inside it went
  // with it — tapping "Log pull" on a phone closed the menu and nothing else.
  const [pullOpen, setPullOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close the More dropdown on an outside click.
  useEffect(() => {
    if (!moreOpen) return;
    function onDocClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [moreOpen]);

  // The login and account-setup screens are their own full-bleed splash —
  // nobody on them has a session to navigate with.
  if (pathname === "/login" || pathname.startsWith("/join")) return null;

  const links = LINKS.filter((l) => !l.admin || isAdmin);
  const underMore = (l: (typeof LINKS)[number]) => l.more || (!!l.moreForAdmin && isAdmin);
  const inlineLinks = links.filter((l) => !underMore(l));
  const moreLinks = links.filter(underMore);

  function isActive(href: string) {
    if (href === "/") return pathname === "/" || pathname.startsWith("/unit");
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const moreActive = moreLinks.some((l) => isActive(l.href));

  const mobileLink = (l: (typeof LINKS)[number]) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOpen(false)}
      className={`block min-h-11 rounded-control px-3 py-2.5 text-sm font-medium transition ${
        isActive(l.href)
          ? "bg-surface-2 text-ink-primary"
          : "text-ink-secondary hover:text-ink-primary"
      }`}
    >
      {l.label}
    </Link>
  );

  // Logging out is a POST: a GET link that clears the session can be fired by
  // link previews and prefetching.
  const logoutForm = (cls: string) => (
    <form method="post" action="/api/logout">
      <button type="submit" className={cls} title="Log out">
        Log out
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface-4/85 pt-[env(safe-area-inset-top)] backdrop-blur-[8px]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-baseline gap-1.5"
        >
          <span className="font-display text-base font-extrabold tracking-[-0.01em] text-ink-primary">
            Par
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Mason Homes
          </span>
        </Link>

        {/* Desktop links. No overflow clip here — it would hide the More menu,
            which is absolutely positioned and drops below the bar. */}
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {inlineLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative shrink-0 rounded-control px-3 py-1.5 text-sm font-medium transition duration-150 ease-out ${
                isActive(l.href)
                  ? "bg-surface-2 text-ink-primary"
                  : "text-ink-tertiary hover:text-ink-secondary"
              }`}
            >
              {l.label}
              {/* Active-tab marker. Brand note: a second red accent can share
                  the bar with the red CTA — wayfinding is function, kept tiny. */}
              {isActive(l.href) && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-red"
                />
              )}
            </Link>
          ))}

          {moreLinks.length > 0 && (
            <div className="relative shrink-0" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-1 rounded-control px-3 py-1.5 text-sm font-medium transition duration-150 ease-out ${
                  moreActive || moreOpen
                    ? "bg-surface-2 text-ink-primary"
                    : "text-ink-tertiary hover:text-ink-secondary"
                }`}
              >
                More
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`transition-transform duration-150 ${moreOpen ? "rotate-180" : ""}`}
                >
                  <path d="M5 7.5l5 5 5-5" />
                </svg>
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-card border border-line bg-surface-4/95 p-1 shadow-e1 backdrop-blur-[8px]"
                >
                  {moreLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={`block rounded-control px-3 py-2 text-sm font-medium transition ${
                        isActive(l.href)
                          ? "bg-surface-2 text-ink-primary"
                          : "text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <ThemeToggle />
          {isAdmin && (
            <div className="hidden md:block">
              <button
                type="button"
                onClick={() => setPullOpen(true)}
                className={PULL_TRIGGER.primary}
              >
                Log pull
              </button>
            </div>
          )}
          {viewerName && (
            <span
              className="hidden items-center gap-2 pl-1 text-xs text-ink-tertiary md:inline-flex"
              title={`Logged in as ${viewerName}`}
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface-3 font-display text-[11px] font-bold text-ink-primary"
              >
                {initials}
              </span>
              <span className="max-w-[8rem] truncate">{viewerName}</span>
            </span>
          )}
          <div className="hidden md:block">
            {logoutForm(
              "shrink-0 rounded-control px-2 py-1.5 text-xs font-medium text-ink-tertiary transition hover:text-ink-primary",
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-control border border-line-strong bg-surface-3 text-ink-secondary transition hover:text-ink-primary md:hidden"
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h14M3 10h14M3 14h14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-line bg-surface-4/95 backdrop-blur-[8px] md:hidden">
          <nav className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-6">
            {links.filter((l) => !l.admin).map(mobileLink)}
            {isAdmin && (
              <>
                <p className="mt-2 border-t border-line px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Manager
                </p>
                {links.filter((l) => l.admin).map(mobileLink)}
              </>
            )}
            {isAdmin && (
              <div className="px-1 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setPullOpen(true);
                  }}
                  className={PULL_TRIGGER.primary}
                >
                  Log pull
                </button>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-3 pt-2">
              {viewerName ? (
                <span className="flex min-w-0 items-center gap-2 text-xs text-ink-tertiary">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-3 font-display text-[11px] font-bold text-ink-primary"
                  >
                    {initials}
                  </span>
                  <span className="truncate">
                    Logged in as <b className="text-ink-secondary">{viewerName}</b>
                  </span>
                </span>
              ) : (
                <span />
              )}
              {logoutForm(
                "min-h-9 shrink-0 rounded-control px-3 text-sm font-medium text-ink-tertiary hover:text-ink-primary",
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Lives outside both menus so neither can unmount it. */}
      {isAdmin && <PullModal open={pullOpen} onClose={() => setPullOpen(false)} />}
    </header>
  );
}
