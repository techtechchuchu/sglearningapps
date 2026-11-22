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
  new Function("require", "module", "exports", compiled)(
    (name) => name.endsWith(".json") ? require(path.resolve(path.dirname(file), name)) : loadTypescript(path.resolve(path.dirname(file), `${name}.ts`)),
    module,
    module.exports,
  );
  return module.exports;
}

const { parseUtcDbTime } = loadTypescript(path.resolve(__dirname, "../lib/db-time.ts"));
const { buildReportStatus } = loadTypescript(path.resolve(__dirname, "../lib/report-status.ts"));

test("UTC database time displays as Korean local time", () => {
  const date = parseUtcDbTime("2026-11-22 02:43:39.08");
  assert.equal(date.toISOString(), "2026-11-22T02:43:39.080Z");
  assert.equal(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(date), "11:43");
});

test("a saved answer with a different roster book is flagged for review", () => {
  const roster = [{ student_name: "박서영", teacher_name: "노대근.T", class_name: "예비고1", book_name: "UNIT N제 공통수학1, 마플교과서 공통수학1", enrollment_status: "재원" }];
  const answers = [{ id: 1505, username: "박서영", unit: "마플교과서 공통수학2", problem: "190, 223, 227, 229, 236", created_at: "2026-11-22 02:43:39.08" }];
  const reports = [{ teacher_name: "노대근.T", period_start: "2026-11-15T17:00:00", cutoff_at: "2026-11-20T14:15:00" }];
  const now = Date.parse("2026-11-22T06:00:00Z");
  const status = buildReportStatus(roster, answers, reports, now);
  assert.equal(status.next.length, 0);
  assert.equal(status.unmatched.length, 1);
  assert.equal(status.unmatched[0].count, 5);
  assert.equal(status.unmatched[0].latest, "2026-11-22T02:43:39.080Z");
  const corrected = buildReportStatus([{ ...roster[0], book_name: "마플교과서 공통수학2" }], answers, reports, now);
  assert.equal(corrected.next.length, 1);
  assert.equal(corrected.unmatched.length, 0);
});
