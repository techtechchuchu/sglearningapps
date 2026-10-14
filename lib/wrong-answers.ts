import rawXpattern from "./xpattern-map.json";

type Block = { offset: number; max: number; exam_type: string };
export const xpatternMap = rawXpattern as Record<string, Record<string, Block[]>>;

export function splitRosterBooks(value: unknown): string[] {
  return String(value || "").split(",").map((part) => part.trim()).filter(Boolean);
}

export function parseProblemNumbers(value: unknown): string[] {
  const parts = String(value || "").split(/[,\s，]+/).map((n) => n.trim()).filter(Boolean);
  if (!parts.length || parts.some((n) => !/^\d+$/.test(n))) throw new Error("문제번호는 숫자를 쉼표로 구분해 입력해주세요.");
  const unique = new Set(parts);
  if ([...unique].some((n) => !Number.isSafeInteger(Number(n)) || Number(n) <= 0) || unique.size > 200) throw new Error("문제번호를 확인해주세요.");
  return [...unique];
}

export function examOptions(book: string) {
  return Object.entries(xpatternMap[book] || {}).flatMap(([school, blocks]) =>
    blocks.map((block) => ({
      id: `${school}|${block.offset}`,
      school,
      offset: block.offset,
      max: block.max,
      examType: block.exam_type,
      requiresConfirmation: blocks.length > 1,
      label: `${school}${block.exam_type ? ` · ${block.exam_type}` : ""}`,
    }))
  ).sort((a, b) => a.school.localeCompare(b.school, "ko"));
}

export function normalizeSubmittedNumbers(book: string, rawNumbers: unknown, examId: unknown, confirmed: boolean) {
  const numbers = parseProblemNumbers(rawNumbers);
  const options = examOptions(book);
  if (!options.length) return { numbers, memoPrefix: "", exam: null };
  const exam = options.find((option) => option.id === examId);
  if (!exam) throw new Error("학교와 시험을 선택해주세요.");
  if (exam.requiresConfirmation && !confirmed) throw new Error("같은 학교의 시험이 여러 개입니다. 시험 시기를 확인해주세요.");
  if (numbers.some((number) => Number(number) > exam.max)) throw new Error(`이 시험의 문제번호는 1~${exam.max}번입니다.`);
  return {
    numbers: numbers.map((number) => String(exam.offset + Number(number))),
    memoPrefix: `[${exam.school}${exam.examType ? ` ${exam.examType}` : ""}]`,
    exam,
  };
}

export function displayProblemNumbers(book: string, problem: unknown) {
  const options = examOptions(book);
  if (!options.length) return String(problem || "");
  let numbers: string[];
  try { numbers = parseProblemNumbers(problem); } catch { return String(problem || ""); }
  const grouped = new Map<string, string[]>();
  const unmatched: string[] = [];
  for (const number of numbers) {
    const match = options.find((option) => option.offset < Number(number) && Number(number) <= option.offset + option.max);
    if (match) grouped.set(match.label, [...(grouped.get(match.label) || []), String(Number(number) - match.offset)]);
    else unmatched.push(number);
  }
  if (grouped.size === 1 && !unmatched.length) return [...grouped.values()][0].join(", ");
  return [...[...grouped].map(([label, values]) => `${label}: ${values.join(", ")}`), ...(unmatched.length ? [`확인필요: ${unmatched.join(", ")}`] : [])].join(" / ");
}
