import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="nexus-auth">
      <section className="glass-card nexus-auth-card" aria-labelledby="login-title">
        <header className="nexus-auth-header">
          <div className="inline-flex items-center gap-3">
            <Image src="/nexus-logo.svg" alt="" width={38} height={38} />
            <span className="text-xl font-semibold tracking-[.18em]">NEXUS</span>
          </div>
          <h1 id="login-title">Selamat datang kembali</h1>
          <p>Temukan peluang, bangun squad, dan raih<br className="hidden sm:block" /> pencapaian berikutnya bersama NEXUS.</p>
        </header>
        <LoginForm />
      </section>
    </main>
  );
}
