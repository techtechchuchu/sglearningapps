import { parseProblemNumbers, splitRosterBooks } from "./wrong-answers";

type Row = Record<string, any>;
export type ReportStatusRow = {
  teacher: string; className: string; student: string; book: string;
  count: number; cutoff: string; first: string; latest: string;
  suggestedDate: string; school: string; grade: string; window: string;
};

const weekdays: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };
const fixedDelivery: Record<string, number> = { "박병민.T": 3, "이주백.T": 5 };

function timestamp(value: unknown): number {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}+09:00`);
}

function kstParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function shortDate(ms: number, time = true) {
  if (!Number.isFinite(ms)) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).format(ms);
}

function nextDelivery(teacher: string, className: string, cutoff: number) {
  const parts = kstParts(cutoff);
  const base = Date.UTC(parts.year, parts.month - 1, parts.day);
  const match = className.match(/(?<![가-힣])[월화수목금토일]{1,7}(?![가-힣])/);
  const days = fixedDelivery[teacher] == null ? new Set([...(match?.[0] || "")].map((char) => weekdays[char])) : new Set([fixedDelivery[teacher]]);
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = base + offset * 86400000;
    if (days.has(new Date(candidate).getUTCDay())) return shortDate(candidate - 9 * 3600000, false);
  }
  return "-";
}

function addAnswer(target: Map<string, ReportStatusRow>, key: string, roster: Row, answer: Row, cutoff: number, suggestedDate = "") {
  const when = timestamp(answer.created_at);
  if (!Number.isFinite(when)) return;
  const entry = target.get(key) || {
    teacher: String(roster.teacher_name || ""), className: String(roster.class_name || ""), student: String(roster.student_name || ""),
    book: "", count: 0, cutoff: shortDate(cutoff), first: new Date(when).toISOString(), latest: new Date(when).toISOString(),
    suggestedDate, school: String(roster.school_name || ""), grade: String(roster.grade || ""), window: "",
  };
  const books = new Set(splitRosterBooks(entry.book));
  books.add(String(answer.unit || "").trim());
  entry.book = [...books].filter(Boolean).join(", ");
  try { entry.count += parseProblemNumbers(answer.problem).length; } catch { /* legacy malformed number */ }
  const first = timestamp(entry.first);
  const latest = timestamp(entry.latest);
  if (!Number.isFinite(first) || when < first) entry.first = new Date(when).toISOString();
  if (!Number.isFinite(latest) || when > latest) entry.latest = new Date(when).toISOString();
  target.set(key, entry);
}

export function buildReportStatus(roster: Row[], answers: Row[], reports: Row[], now = Date.now()) {
  const active = roster.filter((row) => row.enrollment_status !== "퇴원");
  const latestReports = new Map<string, Row>();
  for (const report of reports) {
    const teacher = String(report.teacher_name || "").trim();
    if (!teacher || !Number.isFinite(timestamp(report.cutoff_at))) continue;
    if (!latestReports.has(teacher) || timestamp(report.cutoff_at) > timestamp(latestReports.get(teacher)?.cutoff_at)) latestReports.set(teacher, report);
  }
  const today = kstParts(now);
  const day = Date.UTC(today.year, today.month - 1, today.day);
  const daysSinceWednesday = (new Date(day).getUTCDay() - 3 + 7) % 7;
  const wednesday = day - daysSinceWednesday * 86400000 - 9 * 3600000;
  const window = `${shortDate(wednesday)} ~ ${shortDate(now)}`;
  const byStudent = new Map<string, Row[]>();
  for (const answer of answers) {
    const student = String(answer.username || "").trim();
    if (student) byStudent.set(student, [...(byStudent.get(student) || []), answer]);
  }
  const delivered = new Map<string, ReportStatusRow>();
  const next = new Map<string, ReportStatusRow>();
  const submitted = new Map<string, ReportStatusRow>();
  const missing = new Map<string, ReportStatusRow>();
  const seenLinks = new Set<string>();
  for (const row of active) {
    const teacher = String(row.teacher_name || "").trim();
    const student = String(row.student_name || "").trim();
    const className = String(row.class_name || "").trim();
    if (!student || !teacher) continue;
    const key = `${teacher}\u0000${className}\u0000${student}`;
    const allowed = new Set(splitRosterBooks(row.book_name));
    const studentAnswers = byStudent.get(student) || [];
    const matched = studentAnswers.filter((answer) => allowed.has(String(answer.unit || "").trim()));
    for (const answer of matched) {
      const link = `${key}\u0000${String(answer.unit || "").trim()}\u0000${answer.id ?? `${answer.created_at}|${answer.problem}`}`;
      if (seenLinks.has(link)) continue;
      seenLinks.add(link);
      const when = timestamp(answer.created_at);
      if (!Number.isFinite(when)) continue;
      if (when >= wednesday && when <= now) addAnswer(submitted, key, row, answer, now);
      const report = latestReports.get(teacher);
      if (!report) continue;
      const cutoff = timestamp(report.cutoff_at);
      const start = report.period_start ? timestamp(report.period_start) : -Infinity;
      if (when >= start && when <= cutoff) addAnswer(delivered, key, row, answer, cutoff);
      if (when > cutoff) addAnswer(next, key, row, answer, cutoff, nextDelivery(teacher, className, cutoff));
    }
    if (latestReports.has(teacher) && !studentAnswers.some((answer) => {
      const when = timestamp(answer.created_at);
      return when >= wednesday && when <= now;
    })) {
      const dates = studentAnswers.map((answer) => timestamp(answer.created_at)).filter(Number.isFinite);
      missing.set(key, { teacher, className, student, book: "", count: 0, cutoff: "", first: "", latest: dates.length ? shortDate(dates.reduce((max, date) => Math.max(max, date), -Infinity)) : "-", suggestedDate: "", school: String(row.school_name || ""), grade: String(row.grade || ""), window });
    }
  }
  const rows = (items: Map<string, ReportStatusRow>) => [...items.values()].sort((a, b) => `${a.teacher}|${a.className}|${a.student}`.localeCompare(`${b.teacher}|${b.className}|${b.student}`, "ko"));
  return { delivered: rows(delivered), next: rows(next), submitted: rows(submitted), missing: rows(missing), reportCount: latestReports.size, window };
}

