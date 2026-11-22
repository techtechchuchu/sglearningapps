// wrong_answers and school_exam_wrong_answers store UTC in timestamp-without-time-zone columns.
export function parseUtcDbTime(value: unknown): Date {
  const raw = String(value || "").trim().replace(" ", "T");
  if (!raw) return new Date(NaN);
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
}

export function formatKoreanDbTime(value: unknown): string {
  const date = parseUtcDbTime(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
