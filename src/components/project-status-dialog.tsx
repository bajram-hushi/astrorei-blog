"use client";

import { useState } from "react";
import { updateProjectStatus } from "@/app/actions";

const PROJECT_STATUSES = ["idea", "concept", "validation", "building", "launched", "archived"] as const;

type Props = {
  projectId: string;
  currentStatus: string;
};

export function ProjectStatusDialog({ projectId, currentStatus }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        Update status
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">Update project status</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>

            <form action={updateProjectStatus} className="space-y-3">
              <input type="hidden" name="project_id" value={projectId} />

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase text-zinc-600">New status</span>
                <select
                  name="to_status"
                  defaultValue={currentStatus}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase text-zinc-600">Rationale</span>
                <textarea
                  name="rationale"
                  rows={3}
                  required
                  placeholder="Why is this project moving to a new status?"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700"
                >
                  Save status
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
