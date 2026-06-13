// app/api/upload/route.ts
import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Expect a multipart/form-data request with a file field named "file"
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
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

  const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(fileName);
  return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
}
