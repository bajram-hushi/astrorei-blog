"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { browserSupportsPush, getPushErrorMessage, registerCurrentDeviceForPush } from "@/lib/push-client";

type Props = {
  vapidPublicKey?: string;
};

const DISMISSED_KEY = "notifications-prompt-dismissed-until";
const SNOOZE_MS = 10 * 60 * 1000; // 10 minutes

export function NotificationsPromptDialog({ vapidPublicKey }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (!browserSupportsPush()) return;
    if (!vapidPublicKey) return;
    const snoozedUntil = Number(sessionStorage.getItem(DISMISSED_KEY) ?? 0);
    if (Date.now() < snoozedUntil) return;

    const id = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(id);
  }, [vapidPublicKey]);

  const handleEnable = async () => {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError(null);

    const result = await registerCurrentDeviceForPush(vapidPublicKey);

    if (!result.ok) {
      setError(getPushErrorMessage(result.reason, "Impossibile attivare le notifiche."));
      setBusy(false);
      return;
    }

    setBusy(false);
    setOpen(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, String(Date.now() + SNOOZE_MS));
    setOpen(false);
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-end justify-center bg-zinc-950/60 px-4 pb-6 sm:items-center sm:pb-0">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
        <div className="bg-zinc-50 flex items-center justify-center px-8 pt-6 pb-2">
          <Image
            src="/notify-rei.png"
            alt="Rei vuole inviarti notifiche"
            width={260}
            height={260}
            priority
            className="h-auto w-44 sm:w-52 drop-shadow-md"
          />
        </div>

        <div className="px-5 pt-3 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">ReiLabs</p>
          <h2 className="mt-1 text-lg font-bold text-zinc-900">Attiva le notifiche</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Ricevi aggiornamenti su commenti, risposte e gli easter egg del laboratorio — direttamente sul tuo dispositivo.
          </p>

          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Attivazione..." : "Attiva notifiche"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Magari dopo
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
