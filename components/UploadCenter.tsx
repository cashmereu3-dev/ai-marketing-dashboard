"use client";
// components/UploadCenter.tsx
import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function UploadCenter() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUrl(data.url);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-glass rounded-lg shadow-glow max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-primary">Upload a file</h2>
      <input
        type="file"
        onChange={handleFileChange}
        className="border border-gray-300 rounded p-2 mb-4 w-full"
        disabled={uploading}
      />
      <button
        onClick={uploadFile}
        disabled={uploading || !file}
        className="bg-primary text-white px-4 py-2 rounded hover:opacity-90 transition"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
      {url && (
        <div className="mt-4">
          <p className="text-sm text-foreground">File URL:</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">
            {url}
          </a>
        </div>
      )}
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </div>
  );
}
