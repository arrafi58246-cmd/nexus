import { useState, type ChangeEvent, type RefObject } from "react";

import type { PasswordRequirement } from "./registerTypes";

const passwordInputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function PasswordVisibilityIcon({ isVisible }: { isVisible: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!isVisible && <path d="m4 4 16 16" />}
    </svg>
  );
}

type PasswordFieldProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  meetsPolicy: boolean;
  requirements: PasswordRequirement[];
};

export function PasswordField({ value, onChange, meetsPolicy, requirements }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
      <div className="relative">
        <input id="password" name="password" type={isVisible ? "text" : "password"} autoComplete="new-password" placeholder="Masukkan password" value={value} onChange={onChange} minLength={8} maxLength={64} className={passwordInputClassName} aria-invalid={value.length > 0 && !meetsPolicy} aria-describedby="password-security-note password-requirements" required />
        <button type="button" onClick={() => setIsVisible((current) => !current)} aria-label={isVisible ? "Sembunyikan password" : "Tampilkan password"} aria-controls="password" aria-pressed={isVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <PasswordVisibilityIcon isVisible={isVisible} />
        </button>
      </div>
      <p id="password-security-note" className="mt-2 text-xs leading-5 text-slate-500">Gunakan password khusus untuk NEXUS. Demi keamanan, jangan gunakan password yang sama dengan password Email UNESA Anda.</p>
      <ul id="password-requirements" aria-label="Persyaratan password NEXUS" className="mt-3 space-y-1.5 text-xs">
        {requirements.map((requirement) => (
          <li key={requirement.label} className={requirement.isMet ? "flex items-center gap-2 text-emerald-600" : "flex items-center gap-2 text-slate-400"}>
            <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center font-bold">
              {requirement.isMet ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m3 8 3 3 7-7" /></svg> : <span className="h-2.5 w-2.5 rounded-full border border-current" />}
            </span>
            <span className="sr-only">{requirement.isMet ? "Terpenuhi:" : "Belum terpenuhi:"}</span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

type PasswordConfirmationFieldProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  mismatch: boolean;
  mismatchMessage: string;
};

export function PasswordConfirmationField({ inputRef, value, onChange, mismatch, mismatchMessage }: PasswordConfirmationFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div>
      <label htmlFor="password-confirmation" className="mb-2 block text-sm font-semibold text-slate-700">Konfirmasi Password</label>
      <div className="relative">
        <input ref={inputRef} id="password-confirmation" name="passwordConfirmation" type={isVisible ? "text" : "password"} autoComplete="new-password" placeholder="Ulangi password" value={value} onChange={onChange} minLength={8} maxLength={64} className={passwordInputClassName} aria-invalid={mismatch} aria-describedby={mismatch ? "password-confirmation-error" : undefined} required />
        <button type="button" onClick={() => setIsVisible((current) => !current)} aria-label={isVisible ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"} aria-controls="password-confirmation" aria-pressed={isVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <PasswordVisibilityIcon isVisible={isVisible} />
        </button>
      </div>
      {mismatch && <p id="password-confirmation-error" role="alert" className="mt-2 text-xs text-red-600">{mismatchMessage}</p>}
    </div>
  );
}
