"use client";
// components/UploadCenter.tsx
// Upload photos, videos and notes to the private content library the agents read from.
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authFetch } from "@/lib/agency/authFetch";

const BUCKET = "agency-content";
interface Item { name: string; size: number | null; type: string | null }

export default function UploadCenter() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const res = await authFetch("/api/agency/content");
    const body = await res.json().catch(() => ({}));
    if (res.ok) setItems((body as { files: Item[] }).files);
    else setMsg((body as { error?: string }).error || "Could not load the library.");
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);

  const upload = async () => {
    setBusy(true);
    setMsg("");
    let done = 0;
    try {
      for (const f of files) {
        setMsg(`Uploading ${f.name} (${done + 1}/${files.length})...`);
        const res = await authFetch("/api/agency/content", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: f.name }),
        });
        const body = (await res.json().catch(() => ({}))) as { path?: string; token?: string; error?: string };
        if (!res.ok || !body.path || !body.token) throw new Error(body.error || "Could not start the upload.");
        const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(body.path, body.token, f, { contentType: f.type || undefined });
        if (error) throw new Error(error.message);
        done++;
      }
      setMsg(`Uploaded ${done} file${done === 1 ? "" : "s"}. The agents can use them now.`);
      setFiles([]);
      await load();
    } catch (e) {
      setMsg(`Upload error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 bg-glass rounded-lg shadow-glow w-full max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-2 text-primary">Content library</h2>
      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
        Private. Upload photos, videos, scripts and brand notes here. Your agents can list and read them.
      </p>
      <input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="border border-gray-300 rounded p-2 mb-4 w-full text-white text-sm"
        disabled={busy}
      />
      <button
        onClick={upload}
        disabled={busy || files.length === 0}
        className="bg-primary text-white px-4 py-2 rounded hover:opacity-90 transition w-full font-medium disabled:opacity-50"
      >
        {busy ? "Uploading..." : `Upload${files.length ? ` ${files.length} file${files.length === 1 ? "" : "s"}` : ""}`}
      </button>
      {msg && <p className="mt-3 text-sm text-gray-300">{msg}</p>}
      {items.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-gray-300 max-h-64 overflow-auto">
          {items.map((i) => (
            <li key={i.name} className="truncate">{i.name.replace(/^\d+_/, "")}{i.size ? ` · ${(i.size / 1024 / 1024).toFixed(1)} MB` : ""}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
