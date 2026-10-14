export type SubmissionReport = {
  filename: string;
  teacher: string;
  startAt: string | null;
  cutoffAt: string | null;
  targetCount: number | null;
  noteCount: number | null;
  ok: boolean;
  error: string;
};

function koreanYear() {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date()));
}

function localTimestamp(year: number, month: number, day: number, hour: number, minute: number): string | null {
  const checked = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (checked.getUTCFullYear() !== year || checked.getUTCMonth() + 1 !== month || checked.getUTCDate() !== day || checked.getUTCHours() !== hour || checked.getUTCMinutes() !== minute) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function parseSubmissionReportText(text: string, filename: string, fallbackYear = koreanYear()): SubmissionReport {
  const report: SubmissionReport = { filename, teacher: "", startAt: null, cutoffAt: null, targetCount: null, noteCount: null, ok: false, error: "" };
  if (!text.trim()) return { ...report, error: "PDF에서 텍스트를 읽지 못했습니다." };

  const teacher = text.match(/(?:원장님반\(\s*)?([가-힣]{2,4})T\)?\s*오답\s*제출\s*명단/);
  if (teacher) report.teacher = `${teacher[1]}.T`;

  const start = text.match(/기준\s*:\s*(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\s+(\d{1,2}):(\d{2})\s*이후\s*제출/);
  const cutoff = text.match(/생성\s*(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (start) report.startAt = localTimestamp(...start.slice(1, 6).map(Number) as [number, number, number, number, number]);
  if (cutoff) report.cutoffAt = localTimestamp(...cutoff.slice(1, 6).map(Number) as [number, number, number, number, number]);

  const counts = text.match(/대상\s*(\d+)명\s*\/\s*오답노트\s*(\d+)건/);
  if (counts) { report.targetCount = Number(counts[1]); report.noteCount = Number(counts[2]); }

  if (!report.startAt || !report.cutoffAt) {
    const fromFilename = filename.match(/\((\d{1,2})[.]?(\d{1,2})\s*(\d{2})(\d{2})\s*~\s*(\d{1,2})[.]?(\d{1,2})\s*(\d{2})(\d{2})\)/);
    if (fromFilename) {
      if (!report.startAt) report.startAt = localTimestamp(fallbackYear, ...fromFilename.slice(1, 5).map(Number) as [number, number, number, number]);
      if (!report.cutoffAt) report.cutoffAt = localTimestamp(fallbackYear, ...fromFilename.slice(5, 9).map(Number) as [number, number, number, number]);
    }
  }

  report.ok = Boolean(report.cutoffAt);
  if (!report.ok) report.error = "제출 마감 시각을 자동으로 찾지 못했습니다.";
  return report;
}
