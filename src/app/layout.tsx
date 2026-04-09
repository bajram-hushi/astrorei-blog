import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NotificationsBlockedDialog } from "../components/notifications-blocked-dialog";
import { NotificationsPromptDialog } from "../components/notifications-prompt-dialog";
import { PwaRegister } from "../components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  themeColor: "#f6f7fb",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full app-bg app-text flex flex-col">
        <PwaRegister />
        <NotificationsBlockedDialog />
        <NotificationsPromptDialog vapidPublicKey={vapidKey} />
        {children}
      </body>
    </html>
  );
}
``;