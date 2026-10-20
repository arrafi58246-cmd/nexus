import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText;

async function home({ user = { id: "qa-user" }, profile = {}, errors = {}, season = true } = {}) {
  const rows = {
    profiles: { nama_lengkap: "QA Student", primary_class_id: 1, role_app: "STUDENT", status_akun: "ACTIVE", ...profile },
    career_xp_totals: { career_xp: 300 },
    seasons: season ? { season_id: "qa-season", nama_season: "QA Season" } : null,
    rank_rules: [{ rank_name: "Bronze", min_xp: 0, max_xp: 299 }],
    current_seasonal_xp_totals: { seasonal_xp: 0 },
    squad_members: [{ squad_id: "qa-squad", mission_id: "qa-mission" }],
    squads: [{ squad_id: "qa-squad", mission_id: "qa-mission", nama_squad: "QA Squad", status_squad: "FULL" }],
    missions: [{ mission_id: "qa-mission", nama_lomba: "QA Mission", cakupan_peserta: "NASIONAL",
      biaya_pendaftaran: "GRATIS", mission_tiers: { kode_tier: "B" } }],
  };
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      assert.ok(Object.hasOwn(rows, table), `Unexpected table: ${table}`);
      const call = { table, filters: [] };
      calls.push(call);
      const result = { data: errors[table] ? null : rows[table], error: errors[table] ?? null };
      const builder = {
        select() { return builder; }, order() { return builder; },
        eq(column, value) { call.filters.push([column, value]); return builder; },
        in() { return builder; }, neq() { return builder; },
        maybeSingle() { return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return builder;
    },
    rpc(name, input) {
      calls.push({ name, input });
      assert.equal(name, "get_current_leaderboard");
      return Promise.resolve({ data: [], error: errors.leaders ?? null });
    },
    storage: { from() { throw Error("Empty leaderboard should not request avatars"); } },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(id) {
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/navigation") return { redirect(to) { throw Error(`redirect:${to}`); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => client };
    if (id.startsWith("@/components/")) return { default: id };
    throw Error(`Unexpected import: ${id}`);
  } });
  const page = await exports.default();
  const dashboard = page.props.children.find((child) => child.type === "@/components/dashboard/Dashboard");
  return { props: dashboard.props, calls };
}

test("Home guards unauthenticated, admin and incomplete student sessions", async () => {
  await assert.rejects(home({ user: null }), /redirect:\/login/);
  await assert.rejects(home({ profile: { role_app: "ADMIN" } }), /redirect:\/admin$/);
  await assert.rejects(home({ profile: { primary_class_id: null } }), /redirect:\/onboarding/);
});

test("Home renders real zero XP and object-shaped Mission tiers with owner-scoped reads", async () => {
  const { props, calls } = await home();
  assert.equal(props.careerXp, 300);
  assert.equal(props.seasonalXp, 0);
  assert.equal(props.xpError, false);
  assert.equal(props.missions[0].tier, "B");
  assert.equal(props.missions[0].squadId, "qa-squad");
  for (const table of ["profiles", "career_xp_totals", "current_seasonal_xp_totals", "squad_members"]) {
    assert.ok(calls.find((call) => call.table === table).filters.some(([key, value]) =>
      key === "user_id" && value === "qa-user"), `${table} must read the signed-in user`);
  }
  assert.equal(calls.find((call) => call.name)?.input.p_scope, "PROGRAM_STUDI");
});

test("Home distinguishes absent season and failed data from successful empty results", async () => {
  const absent = await home({ season: false });
  assert.equal(absent.props.seasonName, null);
  assert.equal(absent.props.seasonalXp, null);
  assert.equal(absent.props.xpError, false);
  assert.ok(!absent.calls.some((call) => call.name));
  const failed = await home({ errors: { career_xp_totals: { message: "QA failure" },
    squad_members: { message: "QA failure" }, leaders: { message: "QA failure" } } });
  assert.equal(failed.props.careerXp, null);
  assert.equal(failed.props.xpError, true);
  assert.equal(failed.props.missionsError, true);
  assert.equal(failed.props.leadersError, true);
});
