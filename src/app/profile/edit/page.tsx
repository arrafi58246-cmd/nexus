import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import ProfileBadgeCollection from "@/components/profile/ProfileBadgeCollection";
import { loadBadgeCollection } from "@/lib/badge-collection";
import { createClient } from "@/lib/supabase/server";

import EditProfileForm from "./EditProfileForm";
import AvatarUploadForm from "./AvatarUploadForm";
import AcademicProfileForm from "./AcademicProfileForm";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error } = await supabase.from("profiles")
    .select("nama_lengkap, bio, foto_profil_path, role_app, status_akun, primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!error && profile?.role_app === "ADMIN") redirect("/admin");
  if (!error && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  if (error || !profile || profile.status_akun !== "ACTIVE") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold">Edit profil belum tersedia</h1>
        <p role="alert" className="mt-4 text-red-700">Data profil atau akses akun sedang tidak tersedia.</p>
      </main>
    );
  }

  const avatarUrl = profile.foto_profil_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.foto_profil_path).data.publicUrl
    : null;
  const [classes, skills, selectedSkills, badgeCollection] = await Promise.all([
    supabase.from("primary_classes").select("primary_class_id,nama_class")
      .order("primary_class_id", { ascending: true }),
    supabase.from("skills").select("skill_id,nama_skill,primary_class_id")
      .order("nama_skill", { ascending: true }),
    supabase.from("user_skills").select("skill_id")
      .eq("user_id", auth.user.id),
    profile.role_app === "STUDENT" ? loadBadgeCollection(supabase, auth.user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="profile" />
      <main className="nexus-page-shell mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Edit profil</h1>
        <p className="mt-2 text-sm text-slate-600">
          Perubahan tersimpan pada profil NEXUS milikmu.
        </p>
        <AvatarUploadForm name={profile.nama_lengkap} avatarUrl={avatarUrl} />
        <EditProfileForm name={profile.nama_lengkap} bio={profile.bio ?? ""} />
        {profile.role_app === "STUDENT" && <ProfileBadgeCollection collection={badgeCollection} />}
        {profile.role_app === "STUDENT" && (
          classes.error || skills.error || selectedSkills.error ||
          !classes.data || !skills.data || !selectedSkills.data ||
          profile.primary_class_id === null ? (
            <p role="alert" className="mt-6 text-sm text-red-700">
              Data Class dan Skills belum dapat dimuat. Coba muat ulang.
            </p>
          ) : (
            <AcademicProfileForm
              classes={classes.data.map((item) => ({
                id: item.primary_class_id, name: item.nama_class,
              }))}
              skills={skills.data.map((item) => ({
                id: item.skill_id, name: item.nama_skill, classId: item.primary_class_id,
              }))}
              currentClassId={profile.primary_class_id}
              currentSkillIds={selectedSkills.data.map((item) => item.skill_id)}
            />
          )
        )}
      </main>
    </div>
  );
}
