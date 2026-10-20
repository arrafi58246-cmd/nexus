import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { readUpload } from "@/lib/uploads/read-upload";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 5_242_880;
const MAX_REQUEST_BYTES = 6_000_000;
const TYPES = {
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/webp": { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

function fail(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

async function getImageType(file: File) {
  if (file.size < 12 || file.size > MAX_AVATAR_BYTES || !Object.hasOwn(TYPES, file.type)) return null;
  const kind = TYPES[file.type as keyof typeof TYPES];
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!kind.signature.every((byte, index) => header[index] === byte)) return null;
  if (file.type === "image/webp" &&
      (header.length < 12 || String.fromCharCode(...header.slice(8, 12)) !== "WEBP")) return null;
  return kind;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host) {
      return fail("Permintaan tidak diizinkan.", 403);
    }
  } catch {
    return fail("Permintaan tidak diizinkan.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return fail("Format pengiriman tidak valid.");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return fail("Foto terlalu besar.", 413);
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return fail("Sesi berakhir. Silakan login kembali.", 401);
  const userId = auth.user.id;
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("foto_profil_path, role_app, status_akun, primary_class_id")
    .eq("user_id", userId).maybeSingle();
  if (profileError) return fail("Data profil belum dapat diperiksa. Coba lagi.", 503);
  if (!profile || profile.status_akun !== "ACTIVE" ||
      (profile.role_app !== "STUDENT" || profile.primary_class_id === null)) {
    return fail("Profil belum dapat diubah dari akun ini.", 403);
  }

  let fields: FormData;
  try {
    fields = await request.formData();
  } catch {
    return fail("Foto tidak dapat dibaca.");
  }
  const storage = supabase.storage.from("avatars");
  const uploaded = await readUpload(fields.get("avatar"), storage, `${userId}/`, MAX_AVATAR_BYTES);
  const file = uploaded?.file;
  if (fields.getAll("avatar").length !== 1 || !(file instanceof File)) {
    return fail("Pilih satu foto profil.");
  }
  const kind = await getImageType(file);
  if (!kind) return fail("Foto harus JPG, PNG, atau WebP asli dan maksimal 5 MiB.");

  if (uploaded?.path && uploaded.path === profile.foto_profil_path) return fail("Pilih foto baru.", 409);
  const path = uploaded?.path ?? `${userId}/${randomUUID()}.${kind.extension}`;
  const { error: uploadError } = uploaded?.path ? { error: null }
    : await storage.upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail("Foto belum berhasil diunggah. Coba lagi.", 503);

  let query = supabase.from("profiles").update({ foto_profil_path: path })
    .eq("user_id", userId).eq("status_akun", "ACTIVE");
  query = profile.foto_profil_path
    ? query.eq("foto_profil_path", profile.foto_profil_path)
    : query.is("foto_profil_path", null);
  const { data: updated, error: updateError } = await query.select("user_id").maybeSingle();
  if (updateError || !updated) {
    await storage.remove([path]);
    return fail("Foto belum tersimpan. Muat ulang lalu coba lagi.", 409);
  }

  const oldPath = profile.foto_profil_path;
  if (oldPath?.startsWith(`${userId}/`) && oldPath !== path) {
    // The new path is committed. Old-file cleanup cannot undo the saved profile.
    try { await storage.remove([oldPath]); } catch { /* Leave saved avatar intact. */ }
  }

  revalidatePath("/", "layout");
  return Response.json({ success: true });
}

