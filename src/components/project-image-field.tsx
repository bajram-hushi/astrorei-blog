"use client";

import { ChangeEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  name?: string;
  defaultValue?: string;
  label?: string;
};

export function ProjectImageField({
  name = "image_url",
  defaultValue = "",
  label = "Card Image",
}: Props) {
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
      const path = `${user.id}/projects/${crypto.randomUUID()}-${safeName}`;
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
      <span className="text-sm font-semibold text-zinc-700">{label} URL (optional)</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name={name}
          type="url"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://images.example.com/project-cover.jpg"
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
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Project cover preview" className="mt-2 h-32 w-full rounded-md border border-zinc-200 object-cover" />
      )}
      {error && <p className="text-xs text-red-700">Upload failed: {error}</p>}
    </label>
  );
}