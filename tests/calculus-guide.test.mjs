import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import katex from 'katex';

const load = async (name) => {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
};
const { chapter7 } = await load('calculus-guide-7');
const { chapter8 } = await load('calculus-guide-8');
const problems = [...chapter7, ...chapter8];
assert.equal(chapter7.length, 25);
assert.equal(chapter8.length, 17);
assert.deepEqual(problems.map(p => p.number), Array.from({ length: 42 }, (_, i) => i + 1));
let formulas = 0;
for (const problem of problems) {
  assert(problem.title && problem.section && problem.question && problem.answer);
  assert(problem.steps.length > 0, `Missing solution for ${problem.number}`);
  for (const formula of [problem.question, problem.answer, ...problem.steps]) {
    const html = katex.renderToString(formula, { throwOnError: true, strict: 'error', trust: false, displayMode: true });
    assert(!html.includes('katex-error'), `Broken formula in ${problem.number}`);
    formulas++;
  }
}
assert(chapter7[12].answer.includes('999'));
assert(chapter8[16].answer.includes('7x+y-11z=5'));
console.log(`PASS: 42 study-guide problems have answers and solutions; ${formulas} formulas render.`);

