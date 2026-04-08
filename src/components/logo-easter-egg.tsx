"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { browserSupportsPush, registerCurrentDeviceForPush } from "@/lib/push-client";

type LogoEasterEggProps = {
  vapidPublicKey?: string;
};

export function LogoEasterEgg({ vapidPublicKey }: LogoEasterEggProps) {
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!browserSupportsPush()) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
  }, []);

  const enableNotifications = async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      const result = await registerCurrentDeviceForPush(vapidPublicKey);
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

      if (!result.ok) {
        setToastMessage(
          result.reason === "permission_denied"
            ? "Hey, dovresti consentire le notifiche dalle impostazioni del browser per usare questo easter egg."
            : result.reason === "unsupported"
              ? "Le web push non sono disponibili in questo browser."
              : "Impossibile attivare le notifiche push su questo dispositivo.",
        );
        return;
      }

      setToastMessage("Notifiche push attivate su questo dispositivo.");
    } finally {
      setBusy(false);
    }
  };

  const triggerPush = async () => {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      if (permission !== "granted") {
        setToastMessage(
          permission === "denied"
            ? "Hey, dovresti consentire le notifiche dalle impostazioni del browser per ricevere gli easter egg di ReiLabs."
            : "Attiva le notifiche per ricevere anche gli easter egg di ReiLabs.",
        );
        return;
      }

      const subscriptionResult = await registerCurrentDeviceForPush(vapidPublicKey);
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

      if (!subscriptionResult.ok) {
        setToastMessage(
          subscriptionResult.reason === "permission_denied"
            ? "Hey, dovresti consentire le notifiche dalle impostazioni del browser per usare questo easter egg."
            : subscriptionResult.reason === "unsupported"
              ? "Le web push non sono disponibili in questo browser."
              : "Impossibile attivare le notifiche push su questo dispositivo.",
        );
        return;
      }

      const response = await fetch("/api/push/easter-egg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: subscriptionResult.subscription,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (response.ok && payload?.message && document.visibilityState === "visible") {
        setToastMessage(payload.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link
        href="/"
        className="inline-flex items-center"
        aria-label="ReiLabs home"
        title="Double click me"
        onDoubleClick={(event) => {
          event.preventDefault();
          void triggerPush();
        }}
      >
        <Image
          src="/reilabs-header-logo.svg"
          alt="ReiLabs"
          width={190}
          height={38}
          priority
          className="h-9 w-auto select-none sm:h-10"
        />
      </Link>

      {toastMessage && typeof document !== "undefined"
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-4 right-4 z-100 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-zinc-900/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-50 shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    ReiLabs
                  </p>
                  <p className="mt-1 leading-relaxed">{toastMessage}</p>
                  {permission !== "granted" && permission !== "unsupported" && vapidPublicKey && (
                    <button
                      type="button"
                      onClick={() => void enableNotifications()}
                      disabled={busy}
                      className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? "Attivazione..." : "Attiva notifiche"}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close notification"
                  onClick={() => setToastMessage(null)}
                  className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}