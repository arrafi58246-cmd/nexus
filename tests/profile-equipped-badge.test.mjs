import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual server page with API-shaped responses, without network,
// credentials, or database writes. This does not replace logged-in browser QA.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/profile/page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ES2020, esModuleInterop: true,
} }).outputText;

function compile(path) {
  const out = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = {};
  vm.runInNewContext(out, { exports: mod, require });
  return mod;
}
const badges = compile("../src/lib/badges.ts");

async function renderProfile(badgeData, badgeError = null) {
  const rows = {
    profiles: { nama_lengkap: "QA Student", role_app: "STUDENT", status_akun: "ACTIVE",
      primary_class_id: 1, program_studi_id: 1, tahun_masuk: 2024 },
    primary_classes: { nama_class: "Technical" },
    program_studi: { nama_program_studi: "QA Program", fakultas_id: 1 },
    fakultas: { nama_fakultas: "QA Faculty" },
    user_skills: [], career_xp_totals: { career_xp: 0 }, seasons: null,
    rank_rules: [{ rank_name: "Bronze", min_xp: 0, max_xp: 299 }],
    user_badges: badgeData,
  };
  const queries = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "qa-user" } }, error: null }) },
    from(table) {
      assert.ok(Object.hasOwn(rows, table), `Unexpected query: ${table}`);
      const query = { table, filters: [] };
      queries.push(query);
      const result = { data: rows[table], error: table === "user_badges" ? badgeError : null };
      const builder = {
        select() { return builder; },
        eq(column, value) { query.filters.push([column, value]); return builder; },
        order() { return builder; }, maybeSingle() { return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return builder;
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(id) {
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/navigation") return { redirect: (to) => { throw Error(`Unexpected redirect ${to}`); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => client };
    if (id === "@/lib/endorsements") return { loadEndorsementSummary: async () => ({}) };
    if (id === "@/lib/badges") return badges;
    if (id === "@/lib/badge-collection") return { loadBadgeCollection: async () => ({ items: [], count: 0 }) };
    if (id === "@/lib/season-history") return { loadSeasonHistory: async () => ({ items: [], count: 0 }) };
    if (id === "@/lib/mission-history") return { loadMissionHistory: async () => ({ items: [], count: 0 }) };
    if (id.startsWith("@/components/") || ["next/image", "next/link", "./RankCard"].includes(id)) {
      return { __esModule: true, default: () => null };
    }
    throw Error(`Unexpected import ${id}`);
  } });
  const page = await exports.default();
  function text(node) {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(text).join(" ");
    const slots = Object.entries(node.props ?? {})
      .filter(([key, value]) => key !== "children" && value && typeof value === "object" && "props" in value)
      .map(([, value]) => value);
    return [text(node.props?.children), ...slots.map(text)].join(" ");
  }
  assert.deepEqual(queries.find((q) => q.table === "user_badges").filters,
    [["user_id", "qa-user"], ["is_equipped", true]]);
  return text(page);
}

test("shows the equipped badge from the many-to-one object response", async () => {
  const output = await renderProfile({ badge_definitions: { badge_name: "Champion" } });
  assert.match(output, /Champion/);
  assert.doesNotMatch(output, /Belum ada Badge terpasang/);
});

test("retains compatibility with an array-shaped relation", async () => {
  assert.match(await renderProfile({ badge_definitions: [{ badge_name: "Runner-up" }] }), /Runner-up/);
});

test("no equipped row and a missing relation retain the empty state", async () => {
  for (const row of [null, { badge_definitions: null }, { badge_definitions: [] }]) {
    assert.match(await renderProfile(row), /Belum ada Badge terpasang/);
  }
});

test("a failed badge query is not shown as an empty collection", async () => {
  const output = await renderProfile(null, { message: "QA unavailable" });
  assert.match(output, /Badge terpasang belum dapat dimuat/);
  assert.doesNotMatch(output, /Belum ada Badge terpasang/);
});
