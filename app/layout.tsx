import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import NavBar from "@/app/components/NavBar";
import { ToastProvider } from "@/app/components/Toast";
import { ConfirmProvider } from "@/app/components/ConfirmSheet";
import OfflineBanner from "@/app/components/OfflineBanner";
import { getViewer } from "@/lib/auth-context";
import "./globals.css";

// Inter — all body, UI text, and data.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Montserrat — headings, nav, buttons, card titles, big numbers.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

// American Captain — display punch only (splash / empty / milestone).
// Capped at 5 uses across the app; bundled from the Mason brand kit.
const americanCaptain = localFont({
  src: [
    { path: "./fonts/American_Captain.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-american-captain",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Par — Mason Homes Inventory",
  description:
    "Par vs actual across every unit and the Stockroom. Every Stockroom pull logged.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B0D",
  // Draw edge-to-edge on notched phones; bars pad with safe-area insets.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  const isAdmin = viewer?.role === "admin";
  // Theme persists in a cookie the server reads, so the right theme renders on
  // the first byte (no flash) and survives the app being closed/reopened.
  const theme =
    (await cookies()).get("mason_theme")?.value === "light" ? "light" : "dark";
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${montserrat.variable} ${americanCaptain.variable}`}
    >
      <body className="font-sans">
        <ToastProvider>
          <ConfirmProvider>
            <NavBar isAdmin={isAdmin} viewerName={viewer?.name ?? ""} />
            <OfflineBanner />
            {children}
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
