"use client";

import { useEffect, useState } from "react";
import { formatEurCompact } from "@/lib/currency";

type UserStats = {
  id: string;
  username: string;
  avatarUrl: string | null;
  memberSince: string;
  stats: {
    postsCount: number;
    commentsCount: number;
    totalVotesReceived: number;
    totalInvestmentReceived: number;
  };
};

interface MentionPopupProps {
  userId: string;
  position: { x: number; y: number };
  onClose: () => void;
  onMouseEnter?: () => void;
}

export function MentionPopup({ userId, position, onClose, onMouseEnter }: MentionPopupProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/user/${userId}/stats`);
        if (!res.ok) throw new Error("Failed to fetch user stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [userId]);

  if (loading) {
    return (
      <div
        className="absolute z-50 w-64 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <p className="text-sm text-zinc-500">Caricamento...</p>
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  const memberSince = new Date(stats.memberSince).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="absolute z-50 w-72 rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onClose}
    >
      {/* Header with avatar and username */}
      <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
        {stats.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stats.avatarUrl}
            alt={`Avatar di ${stats.username}`}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-zinc-100"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold text-zinc-600">
            {stats.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-900">{stats.username}</p>
          <p className="text-xs text-zinc-500">Membro da {memberSince}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-md bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Post</p>
          <p className="text-lg font-bold text-zinc-900">{stats.stats.postsCount}</p>
        </div>
        <div className="rounded-md bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Commenti</p>
          <p className="text-lg font-bold text-zinc-900">
            {stats.stats.commentsCount}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Voti ricevuti</p>
          <p className="text-lg font-bold text-zinc-900">
            {stats.stats.totalVotesReceived > 0 ? "+" : ""}
            {stats.stats.totalVotesReceived}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">Investimenti</p>
          <p className="text-lg font-bold text-emerald-600">
            {formatEurCompact(stats.stats.totalInvestmentReceived)}
          </p>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-zinc-100 px-4 py-2">
        <p className="text-xs text-zinc-400">Clicca per vedere il profilo completo</p>
      </div>
    </div>
  );
}
