import Link from "next/link";

import {
  formatDate,
  formatEnumLabel,
  formatMembershipStatus,
  formatRole,
  formatSquadStatus,
} from "./formatters";
import type { MySquadItem } from "./types";

type SquadCardProps = {
  item: MySquadItem;
  variant: "active" | "history";
  historyDetailsLoadFailed: boolean;
};

export default function SquadCard({
  item,
  variant,
  historyDetailsLoadFailed,
}: SquadCardProps) {
  const isHistory = variant === "history";
  const statusLabel =
    item.squadStatus === "DISBANDED" ? "Dibubarkan" : isHistory && item.membershipStatus !== "ACTIVE"
      ? formatMembershipStatus(item.membershipStatus)
      : formatSquadStatus(item.squadStatus);

  return (
    <article className="squad-workspace-card flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">
            {item.squadName}
          </h3>
          <p className="mt-1 break-words text-sm font-semibold text-slate-700 [overflow-wrap:anywhere]">
            {item.missionName}
          </p>
          <p className="mt-1 break-words text-xs text-slate-500 [overflow-wrap:anywhere]">
            {item.organizer}
          </p>
        </div>
        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {item.tierCode
            ? `${item.tierCode.toLocaleUpperCase("id-ID")}-Rank`
            : "Tier belum tersedia"}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {formatEnumLabel(item.scope)}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {formatEnumLabel(item.mode)}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {formatEnumLabel(item.cost)}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Peran
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {formatRole(item.role)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Anggota
          </dt>
          <dd className="mt-1 font-bold text-slate-800">
            {item.activeMemberCount}/{item.capacity}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            Bergabung
          </dt>
          <dd className="mt-1 font-semibold text-slate-700">
            {formatDate(item.joinedAt)}
          </dd>
        </div>
        {isHistory ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Riwayat
            </dt>
            <dd className="mt-1 font-semibold text-slate-700">
              {formatDate(item.historyDate)}
            </dd>
          </div>
        ) : null}
      </dl>

      {isHistory ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
          {historyDetailsLoadFailed ? (
            <p className="text-slate-500">
              Detail hasil dan XP sedang tidak tersedia.
            </p>
          ) : (
            <>
              <p className="font-semibold text-slate-700">
                Hasil Squad: {item.verifiedResult
                  ? formatEnumLabel(item.verifiedResult)
                  : "Belum ada hasil tervalidasi"}
              </p>
              <p className="mt-1 text-slate-600">
                XP kamu: {item.earnedXp === null ? "Tidak tercatat" : `+${item.earnedXp} XP`}
                {item.xpEarnedAt ? ` · ${formatDate(item.xpEarnedAt)}` : ""}
              </p>
            </>
          )}
        </div>
      ) : null}

      <div className="mt-auto pt-5">
        {isHistory && item.squadStatus === "MISSION_COMPLETED" ? (
          <>
            <Link href={`/squads/${item.squadId}/endorsements`} prefetch={false}
              className="inline-flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              Detail Squad
            </Link>
            <Link href={`/missions/${item.missionId}`} prefetch={false}
              className="mt-3 block text-center text-sm font-semibold text-indigo-700 hover:underline">
              Lihat Mission
            </Link>
          </>
        ) : (
          <Link href={isHistory ? `/missions/${item.missionId}` : `/squads/${item.squadId}`}
            className="inline-flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2">
            {isHistory ? "Lihat Mission" : "Buka Squad Room"}
          </Link>
        )}
      </div>
    </article>
  );
}
