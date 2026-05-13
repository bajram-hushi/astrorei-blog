"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateBlogPostButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/blog-writer", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(body?.detail ?? body?.error ?? "Generazione fallita.");
        return;
      }

      router.push(`/post/${body.id}`);
    } catch {
      setState("error");
      setErrorMsg("Errore di rete. Riprova.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
      >
        {state === "loading" ? "Generazione…" : "Genera con AI"}
      </button>
      {state === "error" && errorMsg && (
        <p className="text-xs text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
