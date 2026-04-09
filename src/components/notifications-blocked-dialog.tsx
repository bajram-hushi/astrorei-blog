"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function NotificationsBlockedDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "denied") {
      setOpen(true);
    }
  }, []);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-zinc-950/70 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Avviso ReiLabs</p>
            <h2 className="mt-1 text-xl font-bold text-zinc-900">Rei ha notato le notifiche bloccate</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Hey, dovresti consentire le notifiche per ricevere update importanti e gli easter egg del laboratorio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Chiudi
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          <Image
            src="/angry-rei.png"
            alt="Rei arrabbiato"
            width={768}
            height={1024}
            priority
            className="h-auto w-full"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/notifications"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            onClick={() => setOpen(false)}
          >
            Apri impostazioni notifiche
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Ignora per ora
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}