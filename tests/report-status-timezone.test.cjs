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
const { parseSubmissionReportText } = loadTypescript(path.resolve(__dirname, "../lib/submission-report.ts"));
const { matchesRosterBook } = loadTypescript(path.resolve(__dirname, "../lib/wrong-answers.ts"));

test("current roster books include their final-term submission variants", () => {
  const allowed = new Set(["X-패턴 공통수학2", "UNIT N제 공통수학2"]);
  assert.equal(matchesRosterBook(allowed, "X-패턴 공통수학2 기말"), true);
  assert.equal(matchesRosterBook(allowed, "UNIT N제 공통수학2 기말"), true);
  assert.equal(matchesRosterBook(allowed, "기하끝 기말"), false);
});

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

test("a book assigned in another class is not reported as a mismatch", () => {
  const roster = [
    { student_name: "권민준", teacher_name: "이주백.T", class_name: "화목 고2 기하", book_name: "기하끝, 기하끝 기말", enrollment_status: "재원" },
    { student_name: "권민준", teacher_name: "박병민.T", class_name: "월수금 고2 미적분1", book_name: "X-패턴 미적분1", enrollment_status: "재원" },
  ];
  const answers = [{ id: 1452, username: "권민준", unit: "기하끝 기말", problem: "25, 31", created_at: "2026-11-18 10:41:52.343" }];
  const reports = [
    { teacher_name: "이주백.T", cutoff_at: "2026-11-17T14:15:00" },
    { teacher_name: "박병민.T", cutoff_at: "2026-11-17T14:15:00" },
  ];
  const status = buildReportStatus(roster, answers, reports, Date.parse("2026-11-22T06:00:00Z"));
  assert.equal(status.unmatched.length, 0);
  assert.equal(status.next.length, 1);
  assert.equal(status.next[0].teacher, "이주백.T");
});

test("the saved PDF roster, not a recalculation, determines delivery", () => {
  const roster = ["강민수", "김소윤"].map((student_name) => ({ student_name, teacher_name: "노대근.T", class_name: "월금일 고1 내신심화반", book_name: "X-패턴 공통수학2 기말", enrollment_status: "재원" }));
  const answers = roster.map((row, id) => ({ id, username: row.student_name, unit: "X-패턴 공통수학2 기말", problem: "1,2", created_at: "2026-11-21 02:00:00" }));
  const reports = [{ teacher_name: "노대근.T", period_start: "2026-11-20 14:00:00", cutoff_at: "2026-11-22 14:32:00", items: [{ student: "강민수", className: "월금일 고1 내신심화반", book: "X-패턴 공통수학2 기말", count: 20 }] }];
  const status = buildReportStatus(roster, answers, reports, Date.parse("2026-11-22T06:00:00Z"));
  assert.deepEqual(status.delivered.map((row) => [row.student, row.count]), [["강민수", 20]]);
  assert.deepEqual(status.next.map((row) => row.student), ["김소윤"]);
});

test("PDF row parsing preserves wrapped class names", () => {
  const text = "원장님반(이주백T) 오답 제출 명단\n기준: 2026-11-20 14:00 ~ 2026-11-22 14:32 제출 · 생성 2026-11-22 14:32\n대상 1명 / 오답노트 1건\n학생   반   교재   제출   수록   생성 못한 번호\n박보승   월금일(뒤) 고1\n내신심화반   X-패턴 공통수학2 기말   6   6   -";
  const report = parseSubmissionReportText(text, "이주백T 오답명단(11.20 1400 ~ 11.22 1432).pdf");
  assert.equal(report.ok, true);
  assert.deepEqual(report.items, [{ student: "박보승", className: "월금일(뒤) 고1 내신심화반", book: "X-패턴 공통수학2 기말", count: 6 }]);
});

