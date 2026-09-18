import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/users";

// Open: the login screen, its endpoint, and the invite link (a new cleaner
// has no session yet — the token in the URL is the credential).
const OPEN_PATHS = [
  "/login",
  "/api/login",
  "/api/setup",
  "/api/cron",
  "/join",
  // Install/branding assets — fetched by the OS before anyone is logged in.
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
];

// Manager-only areas. Cleaners get Home, their unit pages, and the guide;
// everything that reads or moves stock across the portfolio is a manager's.
const ADMIN_PATHS = [
  "/settings",
  "/team",
  "/activity",
  "/restock",
  "/central",
  "/linens",
  "/log",
  "/parking",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // One front door. Sessions are per-host cookies, so two live domains = split
  // logins. Funnel the legacy alias to the canonical domain (temporary redirect
  // so it's never cached hard — easy to undo if the canonical ever changes).
  if (req.headers.get("host") === "inventory.livemasonhomes.com") {
    return NextResponse.redirect(
      `https://parinventory.livemasonhomes.com${pathname}${req.nextUrl.search}`,
      307,
    );
  }

  if (OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Login is invite-link only: a valid signed session is required. With no gate
  // configured (local dev) the app stays open.
  let role: "admin" | "cleaner" | null = null;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    role = session.role;
  } else if (!process.env.APP_PASSWORD) {
    role = "admin"; // no gate configured (local dev)
  }

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    role !== "admin" &&
    ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
