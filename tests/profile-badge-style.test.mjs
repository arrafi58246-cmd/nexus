import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Pure helpers: scope colour, label text, ring tone and rank progress. No network or database.
const require = createRequire(import.meta.url);
function load(path) {
  const out = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = {};
  vm.runInNewContext(out, { exports: mod, require });
  return mod;
}
const { describeBadge, badgeTone, rankTierFromName, facultyAbbreviation, UNIVERSITY_NAME } = load("../src/lib/badges.ts");
const { computeRank } = load("../src/lib/rank-progress.ts");

const base = { badgeName: "Contender", scopeType: null, scopeName: null, rankPosition: null, populationTotal: null };

test("Universitas, Fakultas and Program Studi badges get gold, blue and green tones", () => {
  const univ = describeBadge({ ...base, scopeType: "UNIVERSITAS", rankPosition: 3, populationTotal: 1200 });
  assert.equal(univ.label, `${UNIVERSITY_NAME} No. 3`);
  assert.equal(badgeTone(univ), "univ");
  assert.match(univ.detail, /dari 1\.200 peserta/);

  const faculty = describeBadge({ ...base, scopeType: "FAKULTAS", scopeName: "Fakultas Ekonomika & Bisnis", rankPosition: 10 });
  assert.equal(faculty.label, "Fakultas Ekonomika & Bisnis No. 10");
  assert.equal(badgeTone(faculty), "fakultas");

  const program = describeBadge({ ...base, scopeType: "PROGRAM_STUDI", scopeName: "Bisnis Digital", rankPosition: 1 });
  assert.equal(program.label, "Bisnis Digital No. 1");
  assert.equal(badgeTone(program), "prodi");
});

test("a Contender outside the top three keeps its number and population context", () => {
  const view = describeBadge({ ...base, scopeType: "PROGRAM_STUDI", scopeName: "Bisnis Digital", rankPosition: 54, populationTotal: 1200 });
  assert.equal(view.label, "Bisnis Digital No. 54");
  assert.match(view.detail, /54 dari 1\.200/);
});

test("rank-up badges use the tier shield and no badge keeps the neutral ring", () => {
  const gold = describeBadge({ ...base, badgeName: "Gold" });
  assert.equal(gold.kind, "rank");
  assert.equal(gold.scope, null);
  assert.equal(badgeTone(gold), "gold");
  assert.equal(badgeTone(null), "none");
  assert.equal(describeBadge({ ...base, badgeName: null }), null);
});

test("rank names map to the right shield, splitting plain Silver by XP", () => {
  assert.equal(rankTierFromName("Bronze"), "bronze");
  assert.equal(rankTierFromName("Silver II"), "silver-2");
  assert.equal(rankTierFromName("Silver III"), "silver-3");
  assert.equal(rankTierFromName("Silver", 320), "silver-1");
  assert.equal(rankTierFromName("Silver", 650), "silver-2");
  assert.equal(rankTierFromName("Silver", 999), "silver-3");
  assert.equal(rankTierFromName("Platinum"), "platinum");
  assert.equal(rankTierFromName("Diamond"), "diamond");
  assert.equal(rankTierFromName("Champion"), null);
});

test("faculty abbreviations skip connector words", () => {
  assert.equal(facultyAbbreviation("Fakultas Ekonomika dan Bisnis"), "FEB");
  assert.equal(facultyAbbreviation("Fakultas Ekonomika & Bisnis"), "FEB");
  assert.equal(facultyAbbreviation("Fakultas Teknik"), "FT");
  assert.equal(facultyAbbreviation("Fakultas Matematika dan Ilmu Pengetahuan Alam"), "FMIPA");
});

test("rank progress is measured inside the current band and stops at the top rank", () => {
  const rules = [
    { rank_name: "Bronze", min_xp: 0, max_xp: 299 }, { rank_name: "Silver", min_xp: 300, max_xp: 999 },
    { rank_name: "Gold", min_xp: 1000, max_xp: 2499 }, { rank_name: "Diamond", min_xp: 6000, max_xp: null },
  ];
  const mid = computeRank(500, rules);
  assert.equal(mid.current.rank_name, "Silver");
  assert.equal(mid.next.rank_name, "Gold");
  assert.equal(mid.progress, 28);
  const top = computeRank(7000, rules);
  assert.equal(top.current.rank_name, "Diamond");
  assert.equal(top.next, null);
  assert.equal(top.progress, 100);
});
