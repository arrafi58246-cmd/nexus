"use client";

import { createClient } from "@/lib/supabase/client";

type Bucket = "avatars" | "mission-documents" | "achievement-certificates" | "mission-result-certificates";
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export async function submitWithUploads(url: string, form: FormData,
  bucket: Bucket, names: string[], folderId?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sesi berakhir.");
  const id = folderId ?? crypto.randomUUID();
  const prefix = bucket === "avatars" ? `${data.user.id}/` : `${data.user.id}/${id}/`;
  const storage = supabase.storage.from(bucket);
  const paths: string[] = [];
  const body = new FormData();
  for (const [name, value] of form) body.append(name, value);
  if (bucket !== "avatars") body.set("upload_id", id);
  async function cleanup() {
    try { if (paths.length) await storage.remove(paths); } catch { /* Best effort. */ }
  }
  try {
    for (const name of names) {
      const file = body.get(name);
      if (!(file instanceof File) || !file.size) { body.delete(name); continue; }
      const extension = EXTENSIONS[file.type];
      if (!extension) throw new Error("Format berkas tidak didukung.");
      const suffix = bucket === "mission-result-certificates"
        ? name === "sertifikat" ? "-certificate" : "-supporting"
        : bucket === "mission-documents" && name === "banner" ? "-banner" : "";
      const path = `${prefix}${crypto.randomUUID()}${suffix}.${extension}`;
      const { error: uploadError } = await storage.upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploadError) throw new Error("Berkas belum berhasil diunggah.");
      paths.push(path);
      body.set(name, path);
    }
  } catch (error) {
    await cleanup(); // No application write has started yet.
    throw error;
  }
  // Only paths and text cross the application server's request-size limit.
  const response = await fetch(url, { method: "POST", body });
  if (response.status >= 400 && response.status < 500) await cleanup();
  // A network/5xx error can happen after a commit. Never delete its evidence.
  return response;
}
