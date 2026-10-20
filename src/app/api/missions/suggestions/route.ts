import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  if (name.length < 3 || name.length > 100) return Response.json({ matches: [] });
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return Response.json({ matches: [] }, { status: 401 });
  const pattern = `%${name.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const [missions, own] = await Promise.all([
    supabase.from("missions").select("nama_lomba,penyelenggara,tahun_lomba")
      .ilike("nama_lomba", pattern).limit(5),
    supabase.from("mission_submissions")
      .select("nama_lomba,penyelenggara,tahun_lomba")
      .eq("submitted_by", auth.user.id).ilike("nama_lomba", pattern).limit(5),
  ]);
  if (missions.error || own.error) {
    return Response.json({ matches: [] }, { status: 503 });
  }
  const matches = [...(missions.data ?? []), ...(own.data ?? [])];
  return Response.json({ matches });
}
