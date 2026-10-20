import JoinSquadButton from "../JoinSquadButton";
import SquadApplicationDecisionList from "../SquadApplicationDecisionList";
import SquadCard from "./SquadCard";
import type {
  LeaderApplicationsBySquad,
  MissionSquad,
  SquadRequirement,
} from "./types";

type SquadListProps = {
  missionId: string;
  missionName: string;
  requirementsBySquad: Map<string, SquadRequirement[]>;
  squads: MissionSquad[] | null;
  squadsLoadFailed: boolean;
  squadLeadersLoadFailed: boolean;
  leaderApplicationsLoadFailed: boolean;
  squadLeaderNames: Map<string, string | null>;
  leaderApplicationsBySquad: LeaderApplicationsBySquad;
  pendingApplicationIdsBySquad: Map<string, string>;
  pendingApplicationCount: number;
  applicationStatusLoadFailed: boolean;
  hasActiveMembership: boolean;
  currentUserId: string;
  accountStatus: string | null;
  registrationOpen: boolean;
};

function getSquadStatusLabel(status: string | null): "Open" | "Locked" | null {
  if (status === "OPEN_RECRUITMENT") return "Open";
  if (status === "FULL" || status === "FINALIZED") return "Locked";
  return null;
}

export default function SquadList({
  missionId,
  missionName,
  requirementsBySquad,
  squads,
  squadsLoadFailed,
  squadLeadersLoadFailed,
  leaderApplicationsLoadFailed,
  squadLeaderNames,
  leaderApplicationsBySquad,
  pendingApplicationIdsBySquad,
  pendingApplicationCount,
  applicationStatusLoadFailed,
  hasActiveMembership,
  currentUserId,
  accountStatus,
  registrationOpen,
}: SquadListProps) {
  return (
    <section className="mt-7 sm:mt-8">
      <h2 className="sr-only">Daftar squad sesuai filter</h2>

      {squadLeadersLoadFailed && !squadsLoadFailed && (squads ?? []).length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
        >
          Nama Ketua belum dapat dimuat. Data Squad lainnya tetap ditampilkan.
        </div>
      )}

      {squadsLoadFailed ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="font-bold text-slate-950">Squad belum dapat dimuat</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Data Squad sedang tidak tersedia.
          </p>
        </div>
      ) : (squads ?? []).length === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="font-bold text-slate-950">Belum ada Squad tersedia</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Belum ada Squad yang sesuai dengan filter ini.
          </p>
        </div>
      ) : (
        <div className="squad-grid">
          {(squads ?? []).map((squad) => {
            const leaderName = squadLeaderNames.get(squad.squad_id);
            const statusLabel = getSquadStatusLabel(squad.status_squad);
            const isOwnSquad = squad.ketua_id === currentUserId;
            const pendingApplicationId = pendingApplicationIdsBySquad.get(
              squad.squad_id,
            );
            const hasPendingApplication = Boolean(pendingApplicationId);
            const leaderApplications =
              leaderApplicationsBySquad.get(squad.squad_id) ?? [];
            const acceptDisabledReason =
              squad.status_squad !== "OPEN_RECRUITMENT"
                ? "Squad Locked tidak dapat menerima pelamar baru."
                : !registrationOpen
                  ? "Pendaftaran Mission sudah ditutup."
                  : undefined;
            let joinState:
              | "eligible"
              | "pending"
              | "member"
              | "disabled" = "eligible";
            let disabledReason: string | undefined;

            if (hasActiveMembership || isOwnSquad) {
              joinState = "member";
            } else if (hasPendingApplication) {
              joinState = "pending";
            } else if (applicationStatusLoadFailed) {
              joinState = "disabled";
              disabledReason =
                "Status Join belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.";
            } else if (accountStatus !== "ACTIVE") {
              joinState = "disabled";
              disabledReason =
                "Akun ACTIVE diperlukan untuk mengajukan Join Squad.";
            } else if (!registrationOpen) {
              joinState = "disabled";
              disabledReason = "Pendaftaran Mission sudah ditutup.";
            } else if (pendingApplicationCount >= 3) {
              joinState = "disabled";
              disabledReason =
                "Batas 3 aplikasi Pending pada Mission ini sudah tercapai.";
            }

            const memberCount = squad.active_members?.[0]?.count;
            const countLabel = memberCount === undefined
              ? "Jumlah anggota belum tersedia"
              : `${memberCount}/${squad.kapasitas_anggota} Anggota`;
            // Hanya nama Ketua yang boleh dibaca calon pelamar (get_mission_squad_leaders);
            // anggota lain tampil sebagai lingkaran tanpa identitas.
            const avatars: Array<string | null> = Array.from(
              { length: memberCount ?? 0 },
              (_, index) => (index === 0 && leaderName ? leaderName.trim().charAt(0).toLocaleUpperCase("id-ID") : null),
            );
            const people = leaderName
              ? [{ name: leaderName, role: "Ketua" }]
              : [];
            const statusText = squad.status_squad === "OPEN_RECRUITMENT" ? "Open recruitment" : "Locked";

            return (
              <SquadCard
                key={squad.squad_id}
                name={squad.nama_squad}
                description={squad.deskripsi_squad || "Deskripsi Squad belum tersedia."}
                statusLabel={statusLabel}
                countLabel={countLabel}
                avatars={avatars}
                badge={isOwnSquad ? "Squad kamu" : hasPendingApplication ? "Lamaran Pending" : undefined}
                subtitle={`${statusText} · ${missionName}${memberCount === undefined ? "" : ` · ${memberCount}/${squad.kapasitas_anggota} anggota`}`}
                people={people}
                otherMembers={Math.max((memberCount ?? 0) - people.length, 0)}
                requirements={requirementsBySquad.get(squad.squad_id) ?? []}
                footerNote={squad.status_squad === "OPEN_RECRUITMENT" || hasPendingApplication
                  ? undefined : "Squad terkunci dan tidak menerima aplikasi."}
                action={squad.status_squad === "OPEN_RECRUITMENT" || hasPendingApplication ? (
                  <JoinSquadButton
                    key={`${squad.squad_id}:${joinState}:${pendingApplicationId ?? "none"}`}
                    squadId={squad.squad_id}
                    initialState={joinState}
                    pendingApplicationId={pendingApplicationId}
                    disabledReason={disabledReason}
                  />
                ) : undefined}
                extra={(
                  <>
                    {squadLeadersLoadFailed && (
                      <p className="squad-dialog-note">Nama Ketua belum dapat dimuat.</p>
                    )}
                    {isOwnSquad && (leaderApplicationsLoadFailed ? (
                      <div role="alert" className="squad-dialog-note">
                        Daftar pelamar belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.
                      </div>
                    ) : (
                      <SquadApplicationDecisionList
                        missionId={missionId}
                        key={`${squad.squad_id}:${leaderApplications.map((application) => `${application.applicationId}:${application.applicantUserId ?? "unavailable"}`).join(",")}:${acceptDisabledReason ?? "open"}`}
                        applications={leaderApplications}
                        acceptDisabledReason={acceptDisabledReason}
                      />
                    ))}
                  </>
                )}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
