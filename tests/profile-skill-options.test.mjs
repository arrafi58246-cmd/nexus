import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url), exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/app/profile/edit/AcademicProfileForm.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports, require: id => id === 'next/navigation' ? { useRouter: () => ({ refresh() {} }) }
  : id === './academic-actions' ? {} : require(id) });
const classes = [{ id: 1, name: 'Technical' }, { id: 2, name: 'Creative' }];
const skills = [{ id: 11, classId: 1, name: 'Python' }, { id: 12, classId: 1, name: 'Database' },
  { id: 21, classId: 2, name: 'Figma' }];
function render(currentClassId, currentSkillIds = []) {
  return require('react-dom/server').renderToStaticMarkup(require('react').createElement(exports.default, {
    classes, skills, currentClassId, currentSkillIds,
  }));
}
test('add Skill options show only the selected Primary Class and exclude chosen skills', () => {
  const technical = render(1, [11]);
  assert.match(technical, /<option value="12">Database/);
  assert.doesNotMatch(technical, /<option value="11"|<option value="21"|<optgroup/);
  const creative = render(2);
  assert.match(creative, /<option value="21">Figma/);
  assert.doesNotMatch(creative, /<option value="11"|<option value="12"/);
});
test('previously saved cross-Class skills remain visible and removable', () => {
  const html = render(1, [21]);
  assert.match(html, /<span>Figma<\/span>/);
  assert.match(html, /aria-label="Hapus Figma"/);
  assert.doesNotMatch(html, /<option value="21"/);
});
