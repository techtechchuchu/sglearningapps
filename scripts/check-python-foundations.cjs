const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
// Compile only the three trusted lesson-data modules, without writing generated files.
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  module._compile(result.outputText, filename);
};
const { foundationExamples, examplesForChapter } = require('../app/python-foundations.ts');
const { advancedExamples } = require('../app/python-advanced.ts');
const allExamples = [...foundationExamples, ...advancedExamples];
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(allExamples));
  process.exit(0);
}
const python = process.env.PYTHON_BINARY || 'python';
assert.equal(foundationExamples.length, 19);
assert.equal(advancedExamples.length, 29);
assert.equal(new Set(allExamples.map(e => e.id)).size, allExamples.length);
let checked = 0;
for (const e of allExamples) {
  assert.ok(e.walkthrough.steps.length && e.walkthrough.practiceSteps.length && e.lesson.hint);
  for (const [code, expected] of [[e.lesson.exampleCode, e.walkthrough.output], [e.lesson.solution, e.lesson.expected]]) {
    const result = spawnSync(python, ['-c', e.desktop ? 'import ast,sys; ast.parse(sys.stdin.read())' : code], {
      encoding: 'utf8', input: e.desktop ? code : undefined,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, timeout: 5000,
    });
    assert.equal(result.status, 0, `${e.id}: ${result.error || result.stderr}`);
    if (!e.desktop) assert.equal(result.stdout.replace(/\r/g, '').trim(), expected, e.id);
    checked++;
  }
}
for (let chapter = 1; chapter <= 7; chapter++) assert.ok(examplesForChapter(chapter).length > 1);
console.log(`PASS: ${checked} programs checked across 7 chapters.`);

