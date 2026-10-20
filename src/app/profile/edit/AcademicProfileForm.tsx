"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { addProfileSkill, removeProfileSkill, updatePrimaryClass } from "./academic-actions";

type ClassOption = { id: number; name: string };
type SkillOption = { id: number; name: string; classId: number };
type Result = { success: true } | { success: false; message: string };

export default function AcademicProfileForm({ classes, skills, currentClassId, currentSkillIds }: {
  classes: ClassOption[];
  skills: SkillOption[];
  currentClassId: number;
  currentSkillIds: number[];
}) {
  const [classId, setClassId] = useState(currentClassId);
  const [savedClassId, setSavedClassId] = useState(currentClassId);
  const [selected, setSelected] = useState(currentSkillIds);
  const [candidate, setCandidate] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();
  const chosen = new Set(selected);
  const options = skills.filter((skill) => skill.classId === classId && !chosen.has(skill.id));
  const classChanged = classId !== savedClassId;
  const candidateAvailable = options.some((skill) => String(skill.id) === candidate);

  async function run(action: () => Promise<Result>, onSuccess: () => void) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (!result.success) {
        setError(result.message);
        return;
      }
      onSuccess();
      router.refresh();
    } catch {
      setError("Perubahan belum tersimpan. Muat ulang lalu coba lagi.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
      aria-busy={pending}>
      <div>
        <h2 className="font-semibold">Primary Class</h2>
        <p className="mt-1 text-xs text-slate-600">
          Mengubah Class tidak menghapus Skills atau riwayat Squad.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm font-medium">
            Pilih Class
            <select value={classId} disabled={pending}
              onChange={(event) => {
                setClassId(Number(event.target.value));
                setCandidate("");
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="button" disabled={pending || classId === savedClassId}
            onClick={() => run(() => updatePrimaryClass(classId), () => {
              setSavedClassId(classId);
              setMessage("Primary Class tersimpan.");
            })}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Simpan Class
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h2 className="font-semibold">Skills ({selected.length}/5)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Pilihan mengikuti Primary Class yang dipilih. Maksimal lima Skills.
        </p>
        {classChanged && <p className="mt-1 text-xs text-amber-700">Simpan Class sebelum menambahkan Skill.</p>}
        {selected.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {selected.map((id) => {
              const skill = skills.find((item) => item.id === id);
              return <li key={id} className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-1 text-sm">
                <span>{skill?.name ?? "Skill"}</span>
                <button type="button" disabled={pending}
                  onClick={() => run(() => removeProfileSkill(id), () => {
                    setSelected((current) => current.filter((value) => value !== id));
                    setMessage("Skill dihapus.");
                  })}
                  aria-label={`Hapus ${skill?.name ?? "Skill"}`}
                  className="font-semibold text-red-700 disabled:opacity-60">Hapus</button>
              </li>;
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm font-medium">
            Tambah Skill
            <select value={candidate} disabled={pending || classChanged || selected.length >= 5}
              onChange={(event) => setCandidate(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
              <option value="">Pilih Skill</option>
              {options.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
            </select>
          </label>
          <button type="button" disabled={pending || classChanged || selected.length >= 5 || !candidateAvailable}
            onClick={() => {
              const id = Number(candidate);
              run(() => addProfileSkill(id), () => {
                setSelected((current) => [...current, id]);
                setCandidate("");
                setMessage("Skill ditambahkan.");
              });
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Tambah
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    </section>
  );
}
