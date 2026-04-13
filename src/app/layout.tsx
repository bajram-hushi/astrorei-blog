import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Darker_Grotesque, Geist_Mono } from "next/font/google";
import { NotificationsBlockedDialog } from "../components/notifications-blocked-dialog";
import { NotificationsPromptDialog } from "../components/notifications-prompt-dialog";
import { PwaRegister } from "../components/pwa-register";
import { MobileBottomNav } from "../components/mobile-bottom-nav";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const darkerGrotesque = Darker_Grotesque({
  variable: "--font-darker-grotesque",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReiLabs",
  description: "Blog interno con autenticazione Supabase e Postgres",
  applicationName: "ReiLabs",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ReiLabs",
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const runtime = "nodejs";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const vapidKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim();

  return (
    <html
      lang="it"
      className={`${nunitoSans.variable} ${darkerGrotesque.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full app-bg app-text flex flex-col">
        <PwaRegister />
        <NotificationsBlockedDialog />
        <NotificationsPromptDialog vapidPublicKey={vapidKey} />
        <div className="flex-1 pb-20 sm:pb-0">{children}</div>
        <MobileBottomNav />
      </body>
    </html>
  );
}
``;