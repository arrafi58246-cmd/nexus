import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: id => imports[id] ?? require(id) });
  return exports;
}
const formatters = load('../src/app/my-squad/formatters.ts');
const Card = load('../src/app/my-squad/SquadCard.tsx', {
  './formatters': formatters, 'next/link': { default: 'a' },
}).default;

test('disbanded Squad history keeps its label and Mission link instead of opening a closed Room', () => {
  const element = Card({ variant: 'history', historyDetailsLoadFailed: false, item: {
    squadId: 'qa-squad', missionId: 'qa-mission', squadName: 'QA squad', missionName: 'QA Mission',
    organizer: 'QA', squadStatus: 'DISBANDED', membershipStatus: 'LEFT', role: 'KETUA',
    tierCode: null, scope: 'INTERNAL', mode: 'ONLINE', cost: 'GRATIS', capacity: 2,
    activeMemberCount: 0, joinedAt: '2026-10-13', historyDate: '2026-10-13', earnedXp: null,
  } });
  const text = [], links = [];
  function walk(node) {
    if (node == null || typeof node === 'boolean') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node !== 'object') { text.push(String(node)); return; }
    if (node.props?.href) links.push(node.props.href);
    walk(node.props?.children);
  }
  walk(element);
  assert.ok(text.includes('Dibubarkan'));
  assert.ok(!text.includes('Keluar'));
  assert.deepEqual(links, ['/missions/qa-mission']);
});
