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
    setUrl("");
    
    try {
      const fileName = `${Date.now()}_${file.name}`;
      
      // Try uploading directly from the client to Supabase Storage (bypasses Vercel 4.5MB limit)
      const { data, error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        // If the bucket doesn't exist, call the server initialization route to create it, then retry
        if (uploadError.message.includes("bucket") || uploadError.message.includes("not found")) {
          setError("Initializing storage bucket... Please wait.");
          const initRes = await fetch("/api/upload", {
            method: "POST"
          });
          
          if (initRes.ok) {
            setError("Uploading file...");
            const { data: retryData, error: retryError } = await supabase.storage
              .from("uploads")
              .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
              });
              
            if (retryError) throw retryError;
            
            const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(fileName);
            setUrl(publicUrlData.publicUrl);
            setError("");
          } else {
            throw new Error("Could not initialize the uploads bucket on the server.");
          }
        } else {
          throw uploadError;
        }
      } else {
        const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(fileName);
        setUrl(publicUrlData.publicUrl);
      }
    } catch (e: any) {
      setError(`Upload error: ${e.message || e}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-glass rounded-lg shadow-glow max-w-md mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-primary">Upload a file</h2>
      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
        Direct client-to-storage upload enabled. Bypasses server payload limits (suitable for large media files).
      </p>
      <input
        type="file"
        onChange={handleFileChange}
        className="border border-gray-300 rounded p-2 mb-4 w-full text-white text-sm"
        disabled={uploading}
      />
      <button
        onClick={uploadFile}
        disabled={uploading || !file}
        className="bg-primary text-white px-4 py-2 rounded hover:opacity-90 transition w-full font-medium"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
      {url && (
        <div className="mt-4">
          <p className="text-sm text-foreground">File URL:</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all text-sm">
            {url}
          </a>
        </div>
      )}
      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  );
}
