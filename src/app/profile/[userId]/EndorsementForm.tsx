"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { ENDORSEMENT_FIELDS, type EndorsementField, type EndorsementScores,
  type SharedSquad } from "@/lib/endorsements";
import { submitEndorsement } from "./actions";

function Stars({ label, value, disabled, onChange }: {
  label: string; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  const current = Number(value) || 0;
  return (
    <div className="endorse-stars-row">
      <span>{label}</span>
      <div role="radiogroup" aria-label={label} className="endorse-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" role="radio" aria-checked={current === star}
            aria-label={`${label}: ${star} dari 5`} disabled={disabled}
            className={star <= current ? "is-on" : ""}
            onClick={() => onChange(String(star))}>★</button>
        ))}
      </div>
    </div>
  );
}

export default function EndorsementForm({ targetUserId, squads }: {
  targetUserId: string;
  squads: SharedSquad[];
}) {
  const available = squads.filter((squad) => !squad.alreadyRated && squad.windowOpen);
  const closed = squads.filter((squad) => !squad.alreadyRated && !squad.windowOpen);
  const [squadId, setSquadId] = useState(available.length === 1 ? available[0].squadId : "");
  const selectedSquad = available.find((squad) => squad.squadId === squadId);
  const [values, setValues] = useState<Record<EndorsementField, string>>({
    communication: "", contribution: "", teamwork: "", responsibility: "",
  });
  const [pending, setPending] = useState(false);
  const [submittedSquadId, setSubmittedSquadId] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const router = useRouter();
  const complete = ENDORSEMENT_FIELDS.every(([field]) => values[field] !== "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !selectedSquad || squadId === submittedSquadId) return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      const scores = Object.fromEntries(ENDORSEMENT_FIELDS.map(([field]) => [
        field, Number(values[field]),
      ])) as EndorsementScores;
      const result = await submitEndorsement(targetUserId, squadId, scores);
      if (!result.success) {
        setMessage(result.message);
        if (result.windowClosed) router.refresh();
        return;
      }
      setSubmittedSquadId(squadId);
      setMessage("Penilaian berhasil dikirim.");
      router.refresh();
    } catch {
      setMessage("Penilaian belum tersimpan. Coba lagi.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const form = (
    <form onSubmit={submit} aria-busy={pending}>
      <p>
        Penilaian antar anggota saat finalisasi tersedia selama 14 hari sejak hasil Mission disetujui admin.
      </p>
      <label>Squad yang dinilai
        <select required value={squadId} disabled={pending}
          onChange={(event) => setSquadId(event.target.value)}>
          <option value="">Pilih Squad</option>
          {available.map((squad) => <option key={squad.squadId} value={squad.squadId}>
            {squad.name}</option>)}
        </select>
      </label>
      {selectedSquad?.closesAt && (
        <p style={{ marginTop: 8 }}>
          Batas penilaian: {new Intl.DateTimeFormat("id-ID", {
            dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta",
          }).format(new Date(selectedSquad.closesAt))} WIB.
        </p>
      )}
      {ENDORSEMENT_FIELDS.map(([field, label]) => (
        <Stars key={field} label={label} value={values[field]} disabled={pending}
          onChange={(value) => setValues((current) => ({ ...current, [field]: value }))} />
      ))}
      <button type="submit" disabled={pending || !selectedSquad || !complete || squadId === submittedSquadId}
        className="endorse-send">
        {pending ? "Mengirim…" : "Kirim penilaian"}
      </button>
    </form>
  );

  return (
    <div className="endorse-form">
      {squads.some((squad) => squad.alreadyRated) && (
        <p>
          Sudah dinilai: {squads.filter((squad) => squad.alreadyRated)
            .map((squad) => squad.name).join(", ")}.
        </p>
      )}
      {closed.length > 0 && (
        <p>
          Penilaian ditutup: {closed.map((squad) => squad.name).join(", ")}.
        </p>
      )}
      {available.length > 0 && (
        // Collapsed it is the one-line bar from the design; opening it reveals the four ratings.
        <details className="endorse-details" open={Boolean(submittedSquadId) || undefined}>
          <summary>
            <span aria-hidden="true" className="endorse-preview">★★★★★</span>
            <span>Nilai rekan Squad</span>
          </summary>
          {form}
        </details>
      )}
      {message && <p role="status" style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
