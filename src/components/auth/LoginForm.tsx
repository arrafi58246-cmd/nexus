"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { loginWithProfile } from "@/lib/auth/login";

type LoginFeedback = {
  type: "error" | "success";
  message: string;
};

const inputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

const passwordInputClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function PasswordVisibilityIcon({ isVisible }: { isVisible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {!isVisible && <path d="m4 4 16 16" />}
    </svg>
  );
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordIsVisible, setPasswordIsVisible] = useState(false);
  const [nativeFormIsValid, setNativeFormIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginFeedback, setLoginFeedback] =
    useState<LoginFeedback | null>(null);
  const loginInProgressRef = useRef(false);
  const router = useRouter();

  const formIsValid = nativeFormIsValid && email.length > 0 && password.length > 0;
  const loginCompleted = loginFeedback?.type === "success";
  const submitButtonDisabled =
    !formIsValid || isSubmitting || loginCompleted;

  function handleFormValidityChange(event: FormEvent<HTMLFormElement>) {
    setNativeFormIsValid(event.currentTarget.checkValidity());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      loginInProgressRef.current ||
      isSubmitting ||
      loginCompleted ||
      !formIsValid
    ) {
      return;
    }

    loginInProgressRef.current = true;
    setIsSubmitting(true);
    setLoginFeedback(null);

    try {
      const supabase = createClient();
      const result = await loginWithProfile(supabase, email, password);
      if (!result.success) {
        setLoginFeedback({ type: "error", message: result.message });
        return;
      }
      setLoginFeedback({ type: "success", message: "Login berhasil. Mengarahkan Anda..." });
      router.replace(result.destination);
    } catch {
      setLoginFeedback({
        type: "error",
        message:
          "Login belum berhasil. Periksa koneksi Anda lalu coba lagi.",
      });
    } finally {
      loginInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit}
      onChange={handleFormValidityChange}
      onInput={handleFormValidityChange}
      aria-busy={isSubmitting}
    >
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Email akun NEXUS
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Alamat email akun"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClassName}
          required
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={passwordIsVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={64}
            className={passwordInputClassName}
            required
          />
          <button
            type="button"
            onClick={() => setPasswordIsVisible((isVisible) => !isVisible)}
            aria-label={
              passwordIsVisible
                ? "Sembunyikan password"
                : "Tampilkan password"
            }
            aria-controls="password"
            aria-pressed={passwordIsVisible}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <PasswordVisibilityIcon isVisible={passwordIsVisible} />
          </button>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={submitButtonDisabled}
          className={
            !submitButtonDisabled
              ? "flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
              : "flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-indigo-300 px-5 text-sm font-bold text-white opacity-75 transition"
          }
        >
          {isSubmitting ? "Masuk..." : "Masuk"}
        </button>

        <div
          aria-live="polite"
          className="mt-3 min-h-5 text-center text-xs"
        >
          {isSubmitting ? (
            <p role="status" className="text-slate-500">
              Masuk...
            </p>
          ) : (
            loginFeedback && (
              <p
                role={loginFeedback.type === "error" ? "alert" : "status"}
                className={
                  loginFeedback.type === "error"
                    ? "text-red-600"
                    : "text-emerald-600"
                }
              >
                {loginFeedback.message}
              </p>
            )
          )}
        </div>
      </div>

      <p className="text-center text-sm text-slate-500">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-semibold text-indigo-600 transition hover:text-indigo-700"
        >
          Daftar
        </Link>
      </p>
    </form>
  );
}

