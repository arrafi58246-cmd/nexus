import Image from "next/image";
import type { ReactNode } from "react";

/** Avatar ring + name + equipped badge + tags + bio (+ actions on the own profile). */
export default function ProfileHero({ name, avatarUrl, tone, badge, tags, bio, actions }: {
  name: string;
  avatarUrl: string | null;
  /** Ring colour modifier from badgeTone(): none | univ | fakultas | prodi | <rank tier>. */
  tone: string;
  badge: ReactNode;
  tags: string[];
  bio: string;
  actions?: ReactNode;
}) {
  return (
    <section className="profile-hero2" aria-label="Identitas profil">
      <div className={`profile-avatar profile-avatar--${tone}`}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt={`Foto ${name}`} width={132} height={132} unoptimized />
        ) : (
          <span aria-label="Foto profil belum tersedia" className="profile-avatar-fallback">
            {name.trim().charAt(0).toUpperCase() || "N"}
          </span>
        )}
      </div>
      <div className="profile-hero-main">
        <div className="profile-name-row">
          <h1>{name}</h1>
          {badge}
        </div>
        {tags.length > 0 && (
          <ul className="profile-tags" aria-label="Info akademik">
            {tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        )}
        <p className="profile-bio">{bio}</p>
        {actions && <div className="profile-actions">{actions}</div>}
      </div>
    </section>
  );
}
