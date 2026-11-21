const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypescript(file) {
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
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
  canViewProblemExplanations,
  explanationSubject,
  explanationSubjectsForStudent,
  explanationBooksForStudent,
} = loadTypescript(path.resolve(__dirname, "../lib/problem-explanation-access.ts"));

const leeMath = { teacher_name: "이주백.T", class_name: "월금 고1 탑티어반", book_name: "울산N제 공통수학2, 백미 공통수학2", enrollment_status: "재원" };
const otherGeometry = { teacher_name: "노대근.T", class_name: "화목 고2 기하", book_name: "X-패턴 기하", enrollment_status: "재원" };

test("only active Lee classes and the named exception can open explanations", () => {
  assert.equal(canViewProblemExplanations("학생A", [leeMath]), true);
  assert.equal(canViewProblemExplanations("학생A", [otherGeometry]), false);
  assert.equal(canViewProblemExplanations("학생A", [{ ...leeMath, enrollment_status: "명단 확인 필요" }]), false);
  assert.equal(canViewProblemExplanations("추재현", []), true);
});

test("course choices come only from active Lee class books; the exception gets all five", () => {
  assert.deepEqual(explanationSubjectsForStudent("학생A", [leeMath, otherGeometry]), ["공통수학2"]);
  assert.deepEqual(explanationSubjectsForStudent("추재현", []), ["공통수학2", "미적분1", "기하", "확통", "미적분2"]);
  assert.equal(explanationSubject("확률과통계"), "확통");
  assert.equal(explanationSubject("X-패턴 미적분2 기말"), "미적분2");
});

test("assigned books include their class final editions but exclude other class books", () => {
  const catalogue = ["울산N제 공통수학2", "울산N제 공통수학2 기말", "백미 공통수학2 기말", "UNIT N제 공통수학2 기말", "X-패턴 기하"];
  assert.deepEqual(explanationBooksForStudent("학생A", [leeMath, otherGeometry], catalogue), catalogue.slice(0, 3));
  assert.deepEqual(explanationBooksForStudent("학생A", [{ ...leeMath, enrollment_status: "명단 확인 필요" }], catalogue), []);
  assert.deepEqual(explanationBooksForStudent("추재현", [], catalogue), catalogue);
});
