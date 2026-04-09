"use client";

import { useEffect, useMemo, useState } from "react";
import {
  browserSupportsPush,
  disableCurrentDevicePush,
  getPushErrorMessage,
  registerCurrentDeviceForPush,
} from "@/lib/push-client";

type PushNotificationsToggleProps = {
  initialEnabled: boolean;
  vapidPublicKey?: string;
};

export function PushNotificationsToggle({ initialEnabled, vapidPublicKey }: PushNotificationsToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [secureContext, setSecureContext] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const canUsePush = useMemo(() => {
    return browserSupportsPush();
  }, []);

  useEffect(() => {
    if (!canUsePush) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
    setSecureContext(window.isSecureContext);

    const syncState = async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setEnabled(Boolean(subscription) || initialEnabled);
    };

    void syncState();
  }, [canUsePush, initialEnabled]);

  const enablePush = async () => {
    if (!canUsePush || !vapidPublicKey) {
      setMessage("Le web push non sono disponibili in questo browser o manca la configurazione VAPID.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result = await registerCurrentDeviceForPush(vapidPublicKey);
      setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

      if (!result.ok) {
        setMessage(getPushErrorMessage(result.reason, "Impossibile attivare le notifiche push"));
        return;
      }

      setEnabled(true);
      setMessage("Notifiche push attivate su questo dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossibile attivare le notifiche push.");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    if (!canUsePush) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result = await disableCurrentDevicePush();

      if (!result.ok) {
        throw new Error(result.reason || "subscription_disable_failed");
      }

      setEnabled(false);
      setMessage("Notifiche push disattivate su questo dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossibile disattivare le notifiche push.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      {permission === "default" && !enabled && canUsePush && vapidPublicKey && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Attiva le notifiche push</p>
              <p className="mt-1 text-amber-900">
                Consenti le notifiche per ricevere subito commenti e risposte senza tenere aperta la pagina.
              </p>
            </div>
            <button
              type="button"
              onClick={enablePush}
              disabled={busy}
              className="rounded-md bg-amber-950 px-3 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Richiesta in corso..." : "Consenti notifiche"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Web push</h2>
          <p className="text-sm text-zinc-600">
            Ricevi notifiche su questo dispositivo quando qualcuno commenta un tuo post o risponde a un tuo commento.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || permission === "unsupported" || (!enabled && !vapidPublicKey)}
          onClick={enabled ? disablePush : enablePush}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Aggiornamento..." : enabled ? "Disattiva push" : "Attiva push"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {permission === "denied"
          ? "Il browser ha bloccato le notifiche. Devi riattivarle dalle impostazioni del sito."
          : permission === "unsupported"
            ? "Questo browser non supporta le web push."
            : !secureContext
              ? "Questa pagina non e in secure context: usa HTTPS oppure localhost."
            : enabled
              ? "Push attive."
              : "Push non attive."}
      </p>
      {message && <p className="mt-2 text-xs text-zinc-700">{message}</p>}
    </div>
  );
}
