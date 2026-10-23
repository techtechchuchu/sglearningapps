const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypescript(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => name.endsWith(".json")
    ? require(path.resolve(path.dirname(file), name))
    : loadTypescript(path.resolve(path.dirname(file), `${name}.ts`));
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports;
}

const {
  examIncludesSchool,
  examOptions,
  normalizeSubmittedNumbers,
  displayProblemNumbers,
  parseProblemNumbers,
} = loadTypescript(path.resolve(__dirname, "../lib/wrong-answers.ts"));

test("the new final booklet has unique numbering ranges separate from historical work", () => {
  const options = examOptions("X-패턴 공통수학2");
  const current = options.filter((option) => option.edition === "2026-2-final");
  const historical = options.filter((option) => option.edition === "historical");
  assert.equal(current.length, 33);
  assert.ok(current.every((option) => option.offset >= 100000));
  assert.ok(historical.every((option) => option.offset < 100000));
  assert.equal(new Set(options.map((option) => option.id)).size, options.length);
});

test("a shared section is recommended for either constituent school", () => {
  const shared = examOptions("X-패턴 공통수학2").find((option) => option.edition === "2026-2-final" && option.school.includes("천상고+학성고"));
  assert.ok(shared);
  assert.match(shared.label, /학교 묶음/);
  assert.equal(examIncludesSchool(shared.school, "천상고"), true);
  assert.equal(examIncludesSchool(shared.school, "학성고"), true);
  assert.equal(examIncludesSchool(shared.school, "울산고"), false);
});

test("new and historical answer numbers round-trip without relabeling past records", () => {
  const options = examOptions("X-패턴 공통수학2");
  const current = options.find((option) => option.edition === "2026-2-final" && option.school.includes("천상고+학성고"));
  const historical = options.find((option) => option.edition === "historical" && option.school === "24 함월고");
  assert.ok(current && historical);
  assert.deepEqual(parseProblemNumbers("3, 19"), ["3", "19"]);
  const newEntry = normalizeSubmittedNumbers("X-패턴 공통수학2", "3, 19", current.id, true);
  assert.deepEqual(newEntry.numbers, [String(current.offset + 3), String(current.offset + 19)]);
  assert.equal(displayProblemNumbers("X-패턴 공통수학2", newEntry.numbers.join(", ")), "3, 19");
  const oldEntry = normalizeSubmittedNumbers("X-패턴 공통수학2", "3", historical.id, true);
  assert.deepEqual(oldEntry.numbers, [String(historical.offset + 3)]);
  assert.equal(displayProblemNumbers("X-패턴 공통수학2", oldEntry.numbers.join(", ")), "3");
  assert.throws(() => normalizeSubmittedNumbers("X-패턴 공통수학2", "20", current.id, true), /1~19/);
});

test("mixed-school historical questions are hidden from selection but old answers remain readable", () => {
  const book = "X-패턴 공통수학2";
  const mixedId = "23 천상고+학성고+학성여고|3300";
  assert.equal(examOptions(book).some((option) => option.id === mixedId), false);
  assert.throws(() => normalizeSubmittedNumbers(book, "3", mixedId, true), /학교와 시험/);
  assert.equal(displayProblemNumbers(book, "3303"), "3");
});
