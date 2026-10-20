import Image from "next/image";

import { formatDate, formatEnumLabel } from "./formatters";
import type { MissionDetail, MissionTier } from "./types";

export default function MissionOverview({ mission, relatedTier, tierLabel, posterUrl, bannerUrl }: {
  mission: MissionDetail; relatedTier: MissionTier | null; tierLabel: string;
  posterUrl?: string | null; bannerUrl?: string | null;
}) {
  // Banner = crop buatan pengaju. Tanpa banner, poster ditampilkan utuh di samping
  // dan hanya dipakai sebagai latar blur, supaya teks poster tidak menabrak teks Mission.
  const showPosterCard = !bannerUrl && Boolean(posterUrl);
  const teamSize = mission.min_anggota_tim === null || mission.max_anggota_tim === null ? "Belum tersedia"
    : mission.min_anggota_tim === mission.max_anggota_tim ? `${mission.min_anggota_tim} anggota`
    : `${mission.min_anggota_tim}–${mission.max_anggota_tim} anggota`;
  return (
    <>
      <section className={`mission-banner${bannerUrl ? " has-banner" : ""}${showPosterCard ? " has-poster" : ""}`}
        aria-labelledby="mission-title">
        {bannerUrl && (
          <Image src={bannerUrl} alt="" fill unoptimized sizes="(max-width: 1308px) 100vw, 1244px"
            className="mission-banner-image" priority />
        )}
        {showPosterCard && posterUrl && (
          <Image src={posterUrl} alt="" fill unoptimized sizes="(max-width: 1308px) 100vw, 1244px"
            className="mission-banner-image mission-banner-image-blur" priority />
        )}
        <div className="mission-banner-shade" aria-hidden="true" />
        {showPosterCard && posterUrl && (
          <a href={posterUrl} target="_blank" rel="noopener noreferrer" className="mission-banner-poster"
            aria-label={`Buka poster ${mission.nama_lomba}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={posterUrl} alt={`Poster ${mission.nama_lomba}`} />
          </a>
        )}
        {mission.link_resmi && (
          <a href={mission.link_resmi} target="_blank" rel="noopener noreferrer" className="mission-banner-link">
            Halaman Resmi ↗
          </a>
        )}
        <div className="mission-banner-content">
          <span className="mission-banner-pill">{formatEnumLabel(mission.kategori_lomba)}</span>
          <h1 id="mission-title">{mission.nama_lomba}</h1>
          <p className="mission-banner-sub">{mission.penyelenggara} · {formatEnumLabel(mission.cakupan_peserta)}</p>
          <dl className="mission-facts">
            <div><dt>Deadline Pendaftaran</dt><dd className="mission-deadline"><time dateTime={mission.deadline_pendaftaran}>{formatDate(mission.deadline_pendaftaran)}</time></dd></div>
            <div><dt>Ukuran Squad</dt><dd>{teamSize}</dd></div>
            <div><dt>Tier Mission</dt><dd>{tierLabel}{relatedTier?.nama_tier ? ` · ${relatedTier.nama_tier}` : ""}</dd></div>
            <div><dt>Mode & Biaya</dt><dd>{formatEnumLabel(mission.mode_lomba)} · {formatEnumLabel(mission.biaya_pendaftaran)}</dd></div>
            <div><dt>Deadline Lomba</dt><dd><time dateTime={mission.deadline_lomba ?? undefined}>{formatDate(mission.deadline_lomba)}</time></dd></div>
            <div><dt>Tahun Lomba</dt><dd>{mission.tahun_lomba}</dd></div>
          </dl>
        </div>
      </section>

      <details className="glass-card mission-about">
        <summary>Tentang Mission</summary>
        <p>{mission.deskripsi_singkat || "Deskripsi Mission belum tersedia."}</p>
      </details>
    </>
  );
}
