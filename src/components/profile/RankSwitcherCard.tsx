"use client";

import Image from "next/image";
import { useState } from "react";

import { RANK_ICONS, rankTierFromName } from "@/lib/badges";
import { computeRank, type RankRule } from "@/lib/rank-progress";

const fmt = new Intl.NumberFormat("id-ID");
const STEPS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

function reachedSteps(rankName: string | undefined) {
  const text = (rankName ?? "").toLowerCase();
  const index = STEPS.findIndex((step) => text.includes(step.toLowerCase()));
  return index < 0 ? 0 : index + 1;
}

/** "Career Rank ⌄" card; the dropdown switches between Career and Season rank. */
export default function RankSwitcherCard({ options, rules, area }: {
  options: { key: string; label: string; xp: number }[];
  rules: RankRule[];
  area: string;
}) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const selected = options[index] ?? options[0];
  const { current, next } = computeRank(selected.xp, rules);
  const tier = rankTierFromName(current?.rank_name, selected.xp);
  const reached = reachedSteps(current?.rank_name);
  const switchable = options.length > 1;

  return (
    <section className={`profile-card ${area} rank2`} aria-label="Rank">
      <div className="rank2-head">
        {switchable ? (
          <>
            <button type="button" className="rank2-switch" aria-haspopup="listbox" aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
              {selected.label} <span aria-hidden="true">⌄</span>
            </button>
            {open && (
              <ul role="listbox" aria-label="Pilih jenis rank" className="rank2-menu">
                {options.map((option, position) => (
                  <li key={option.key} role="option" aria-selected={position === index}>
                    <button type="button" onClick={() => { setIndex(position); setOpen(false); }}>
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : <h2>{selected.label}</h2>}
      </div>
      <div className="rank2-body">
        {tier && <Image src={RANK_ICONS[tier]} alt="" width={72} height={72} className="rank2-icon" />}
        <div className="rank2-info">
          <p className="rank2-name">{current?.rank_name ?? "Belum tersedia"}</p>
          <p className="rank2-xp">
            {fmt.format(selected.xp)}{next ? ` / ${fmt.format(next.min_xp)}` : ""} XP
          </p>
          <ol className="rank2-steps" aria-label="Tahap rank">
            {STEPS.map((step, position) => (
              <li key={step} data-on={position < reached} data-step={step.toLowerCase()}>
                <span aria-hidden="true" />
                <small>{step}</small>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
