// app/api/upload/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yeoceamczddelhgligmq.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  // Expect a multipart/form-data request with a file field named "file"
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Initialize client (prefer service role to manage buckets and bypass RLS)
  const client = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

  // Ensure "uploads" bucket exists
  if (serviceRoleKey) {
    try {
      const { data: buckets, error: bucketError } = await client.storage.listBuckets();
      if (!bucketError && buckets) {
        const exists = buckets.some((b) => b.name === "uploads");
        if (!exists) {
          await client.storage.createBucket("uploads", {
            public: true,
            fileSizeLimit: 52428800, // 50MB
          });
        }
      }
    } catch (e) {
      console.warn("Failed to check/create uploads bucket:", e);
    }
  }

  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await client.storage
    .from("uploads")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: publicUrlData } = client.storage.from("uploads").getPublicUrl(fileName);
  return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
}
