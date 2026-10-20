import Image from "next/image";
import { redirect } from "next/navigation";

import OnboardingForm, {
  type PrimaryClass,
  type Skill,
} from "@/components/onboarding/OnboardingForm";
import { createClient } from "@/lib/supabase/server";

function OnboardingError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <section className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <p className="text-sm font-bold tracking-[0.22em] text-indigo-600">NEXUS</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">Onboarding belum dapat dimuat</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Data profil atau pilihan onboarding sedang tidak tersedia. Silakan muat ulang halaman ini beberapa saat lagi.
        </p>
      </section>
    </main>
  );
}

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, role_app, primary_class_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!profileError && profile?.role_app === "ADMIN") redirect("/admin");

  if (profileError || !profile) return <OnboardingError />;
  if (profile.primary_class_id !== null) redirect("/");

  const [primaryClassResult, skillResult] = await Promise.all([
    supabase
      .from("primary_classes")
      .select("primary_class_id, nama_class, deskripsi")
      .order("nama_class"),
    supabase
      .from("skills")
      .select("skill_id, primary_class_id, nama_skill, deskripsi")
      .order("nama_skill"),
  ]);

  if (primaryClassResult.error || skillResult.error) return <OnboardingError />;

  return (
    <main className="nexus-auth-flow relative min-h-screen overflow-hidden bg-slate-50 px-4 py-10 text-slate-900 sm:px-6">
      <div aria-hidden="true" className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />
      <section className="relative mx-auto w-full max-w-4xl rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-10">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-3">
            <span className="nexus-brand"><Image src="/nexus-logo.svg" alt="" width={28} height={28} /></span>
            <span className="text-xl font-bold tracking-[0.22em] text-slate-900">NEXUS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Lengkapi Profil NEXUS</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">Pilih Primary Class yang paling menggambarkan kemampuan utamamu.</p>
        </div>
        <OnboardingForm
          primaryClasses={(primaryClassResult.data ?? []) as PrimaryClass[]}
          skills={(skillResult.data ?? []) as Skill[]}
        />
      </section>
    </main>
  );
}
