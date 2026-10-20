import type { SupabaseClient } from "@supabase/supabase-js";

type Bucket = ReturnType<SupabaseClient["storage"]["from"]>;
const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-(?:certificate|supporting|banner))?\.(pdf|jpg|png|webp)$/i;
const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

// Paths are untrusted input. Download with the caller's RLS session, then run
// the route's existing size/signature validator on the actual stored bytes.
export async function readUpload(value: FormDataEntryValue | null, storage: Bucket,
  prefix: string, maxBytes: number) {
  if (value instanceof File) return { file: value, path: null };
  if (typeof value !== "string" || !value.startsWith(prefix)) return null;
  const name = value.slice(prefix.length);
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  const { data, error } = await storage.download(value, {}, { cache: "no-store" });
  if (error || !data || !data.size || data.size > maxBytes ||
      EXTENSIONS[data.type] !== match[1].toLowerCase()) return null;
  return { file: new File([data], name, { type: data.type }), path: value };
}
