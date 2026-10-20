import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { MAX_FILE_BYTES, validateEvidence } from "@/app/squads/[squadId]/result/file-validation";
import { RESULT_OPTIONS } from "@/app/squads/[squadId]/result/types";
import { createClient } from "@/lib/supabase/server";
import { readUpload } from "@/lib/uploads/read-upload";

export const runtime = "nodejs";

const BUCKET = "achievement-certificates";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(input: string) {
  if (!DATE.test(input)) return false;
  const parsed = new Date(`${input}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === input &&
    input <= new Date().toISOString().slice(0, 10);
}

function fail(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin) {
    try {
      if (!host || new URL(origin).host !== host) return fail("Permintaan tidak diizinkan.", 403);
    } catch {
      return fail("Permintaan tidak diizinkan.", 403);
    }
  }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return fail("Format pengiriman tidak valid.");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 6_000_000) {
    return fail("Berkas terlalu besar.", 413);
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return fail("Silakan login kembali.", 401);
  const userId = auth.user.id;
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app, status_akun, primary_class_id").eq("user_id", userId).maybeSingle();
  if (profileError || profile?.role_app !== "STUDENT" ||
      profile.status_akun !== "ACTIVE" || profile.primary_class_id === null) {
    return fail("Akun mahasiswa belum dapat mengirim klaim.", 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Isian tidak dapat dibaca.");
  }
  const fields = ["claim_id", "nama_kompetisi", "penyelenggara", "achievement_date",
    "submitted_tier_id", "hasil_kompetisi", "sertifikat", "upload_id"];
  if (fields.some((name) => form.getAll(name).length > 1)) return fail("Isian tidak valid.");

  const claimInput = form.get("claim_id");
  const name = form.get("nama_kompetisi");
  const organizer = form.get("penyelenggara");
  const date = form.get("achievement_date");
  const tier = form.get("submitted_tier_id");
  const result = form.get("hasil_kompetisi");
  const uploadId = form.get("upload_id");
  if (uploadId !== null && (typeof uploadId !== "string" || !UUID.test(uploadId) ||
      (claimInput !== null && claimInput !== uploadId))) return fail("Berkas tidak valid.");
  const claimId = String(claimInput ?? uploadId ?? randomUUID());
  const storage = supabase.storage.from(BUCKET);
  const uploaded = await readUpload(form.get("sertifikat"), storage,
    `${userId}/${claimId}/`, MAX_FILE_BYTES);
  const file = uploaded?.file;
  if ((claimInput !== null && (typeof claimInput !== "string" || !UUID.test(claimInput))) ||
      typeof name !== "string" || !name.trim() || name.length > 200 ||
      typeof organizer !== "string" || !organizer.trim() || organizer.length > 200 ||
      typeof date !== "string" || !validDate(date) ||
      typeof tier !== "string" || !/^[1-9]\d*$/.test(tier) ||
      !Number.isSafeInteger(Number(tier)) || typeof result !== "string" ||
      !RESULT_OPTIONS.some((option) => option.value === result) || !(file instanceof File)) {
    return fail("Periksa nama, penyelenggara, tanggal, tier, hasil, dan sertifikat.");
  }
  const kind = await validateEvidence(file);
  if (!kind) return fail("Sertifikat harus PDF/JPG/PNG asli, maksimal 5 MB.");

  const [ruleQuery, oldQuery] = await Promise.all([
    supabase.from("xp_rules").select("legacy_xp")
      .eq("tier_id", Number(tier)).eq("hasil_kompetisi", result).maybeSingle(),
    claimInput
      ? supabase.from("achievement_claims")
          .select("achievement_claim_id, user_id, status_validation, sertifikat_path")
          .eq("achievement_claim_id", claimInput).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (ruleQuery.error || !ruleQuery.data || oldQuery.error) {
    return fail("Aturan XP atau klaim belum dapat diperiksa.", 503);
  }
  const old = oldQuery.data;
  if (claimInput && (!old || old.user_id !== userId || old.status_validation !== "REJECTED")) {
    return fail("Hanya klaim yang ditolak dapat dikirim ulang.", 409);
  }

  if (uploaded?.path && uploaded.path === old?.sertifikat_path) {
    return fail("Gunakan sertifikat baru untuk pengajuan ulang.", 409);
  }
  const path = uploaded?.path ?? `${userId}/${claimId}/${randomUUID()}.${kind.extension}`;
  const { error: uploadError } = uploaded?.path ? { error: null }
    : await storage.upload(path, file, { contentType: kind.contentType, upsert: false });
  if (uploadError) return fail("Sertifikat belum berhasil diunggah. Coba lagi.", 503);

  const changes = {
    nama_kompetisi: name.trim(),
    penyelenggara: organizer.trim(),
    achievement_date: date,
    submitted_tier_id: Number(tier),
    hasil_kompetisi: result,
    sertifikat_path: path,
    preview_xp: ruleQuery.data.legacy_xp,
  };
  const saved = old
    ? await supabase.from("achievement_claims")
        .update({ ...changes, status_validation: "PENDING" })
        .eq("achievement_claim_id", claimId).eq("user_id", userId)
        .eq("status_validation", "REJECTED")
        .select("achievement_claim_id").maybeSingle()
    : await supabase.from("achievement_claims")
        .insert({ ...changes, achievement_claim_id: claimId, user_id: userId })
        .select("achievement_claim_id").maybeSingle();
  if (saved.error || !saved.data) {
    await storage.remove([path]);
    return fail("Klaim belum tersimpan. Muat ulang lalu coba lagi.", 409);
  }

  if (old?.sertifikat_path?.startsWith(`${userId}/${claimId}/`)) {
    // The previous file is no longer referenced; deletion is best effort.
    try { await storage.remove([old.sertifikat_path]); } catch { /* Already saved. */ }
  }
  revalidatePath("/profile/claims");
  revalidatePath("/admin/achievements");
  return Response.json({ success: true, claimId });
}
