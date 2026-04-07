"use client";

import { ChangeEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  defaultValue: string;
};

export function ProfileAvatarField({ defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You need to be logged in to upload.");
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${user.id}/avatars/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("blog-images")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
      setValue(data.publicUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">Profile image URL</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="avatar_url"
          type="url"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://... (leave empty to use Google avatar if available)"
          className="min-w-[18rem] flex-1 rounded-md border border-zinc-300 px-3 py-2"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => setValue("")}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Clear
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
      <p className="text-xs text-zinc-500">If empty, Google profile image is used when available.</p>
      {error && <p className="text-xs text-red-700">Upload failed: {error}</p>}
    </label>
  );
}
