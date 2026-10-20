"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";

import { completeOnboarding } from "@/app/onboarding/actions";

export type PrimaryClass = {
  primary_class_id: number;
  nama_class: string;
  deskripsi: string | null;
};

export type Skill = {
  skill_id: number;
  primary_class_id: number;
  nama_skill: string;
  deskripsi: string | null;
};

type OnboardingFormProps = {
  primaryClasses: PrimaryClass[];
  skills: Skill[];
};

export default function OnboardingForm({ primaryClasses, skills }: OnboardingFormProps) {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const submitInProgressRef = useRef(false);
  const router = useRouter();

  const filteredSkills = useMemo(
    () => skills.filter((skill) => skill.primary_class_id === selectedClassId),
    [selectedClassId, skills],
  );

  function selectClass(classId: number) {
    if (isSubmitting || classId === selectedClassId) return;
    setSelectedClassId(classId);
    setSelectedSkillIds([]);
    setErrorMessage("");
  }

  function toggleSkill(skillId: number) {
    if (isSubmitting) return;
    setErrorMessage("");
    setSelectedSkillIds((current) => {
      if (current.includes(skillId)) return current.filter((id) => id !== skillId);
      if (current.length >= 5) return current;
      return [...current, skillId];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClassId || isSubmitting || submitInProgressRef.current) return;

    submitInProgressRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await completeOnboarding(selectedClassId, selectedSkillIds);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("Onboarding belum dapat disimpan. Silakan coba lagi.");
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting}>
        <legend className="text-base font-bold text-slate-900">Primary Class</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {primaryClasses.map((primaryClass) => {
            const selected = selectedClassId === primaryClass.primary_class_id;
            return (
              <label
                key={primaryClass.primary_class_id}
                className={`relative cursor-pointer rounded-2xl border p-4 outline-none transition focus-within:ring-4 focus-within:ring-indigo-100 ${selected ? "border-indigo-600 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}`}
              >
                <input type="radio" name="primaryClass" value={primaryClass.primary_class_id} checked={selected} onChange={() => selectClass(primaryClass.primary_class_id)} className="sr-only" />
                <span className="block pr-6 font-bold text-slate-900">{primaryClass.nama_class}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">{primaryClass.deskripsi || "Pilih class ini sebagai kemampuan utama."}</span>
                <span aria-hidden="true" className={`absolute right-4 top-4 h-4 w-4 rounded-full border-2 ${selected ? "border-indigo-600 bg-indigo-600 ring-2 ring-indigo-200" : "border-slate-300"}`} />
              </label>
            );
          })}
        </div>
      </fieldset>

      {selectedClassId && (
        <fieldset disabled={isSubmitting} className="mt-8 border-t border-slate-100 pt-7">
          <div className="flex items-center justify-between gap-4">
            <legend className="text-base font-bold text-slate-900">Skills</legend>
            <p className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{selectedSkillIds.length} / 5 Skills dipilih</p>
          </div>
          <p className="mt-2 text-sm text-slate-500">Pilih hingga 5 skills yang paling sesuai. Bagian ini boleh dikosongkan.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filteredSkills.map((skill) => {
              const selected = selectedSkillIds.includes(skill.skill_id);
              const limitReached = selectedSkillIds.length >= 5 && !selected;
              return (
                <label key={skill.skill_id} className={`rounded-xl border p-4 transition ${selected ? "border-indigo-500 bg-indigo-50" : limitReached ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-55" : "cursor-pointer border-slate-200 bg-white hover:border-indigo-300"}`}>
                  <span className="flex items-start gap-3">
                    <input type="checkbox" checked={selected} disabled={limitReached || isSubmitting} onChange={() => toggleSkill(skill.skill_id)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600 focus:ring-indigo-500" />
                    <span>
                      <span className="block text-sm font-bold text-slate-800">{skill.nama_skill}</span>
                      {skill.deskripsi && <span className="mt-1 block text-xs leading-5 text-slate-500">{skill.deskripsi}</span>}
                    </span>
                  </span>
                </label>
              );
            })}
            {filteredSkills.length === 0 && <p className="sm:col-span-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada Skills tersedia untuk Primary Class ini.</p>}
          </div>
        </fieldset>
      )}

      <div className="mt-8">
        {errorMessage && <p role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>}
        <button type="submit" disabled={!selectedClassId || isSubmitting} className="flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:opacity-75">
          {isSubmitting ? "Menyimpan profil..." : "Selesaikan Profil"}
        </button>
      </div>
    </form>
  );
}
