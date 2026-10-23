import rawXpattern from "./xpattern-map.json";
import { XPATTERN_FINAL_2026 } from "./xpattern-final-2026";

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

function allExamOptions(book: string) {
  const finalSections = XPATTERN_FINAL_2026[book as keyof typeof XPATTERN_FINAL_2026] || [];
  const current = finalSections.map((section, index) => ({
    id: `${section.year} ${section.school}|${100000 + index * 100}`,
    school: `${section.year} ${section.school}`,
    offset: 100000 + index * 100,
    max: section.max,
    examType: "2학기 기말 교재",
    edition: "2026-2-final",
    requiresConfirmation: true,
    label: `2026 기말판 · ${section.year} ${section.school}${section.school.includes("+") ? " (학교 묶음)" : ""}`,
  }));
  const historical = Object.entries(xpatternMap[book] || {}).flatMap(([school, blocks]) =>
    blocks.map((block) => ({
      id: `${school}|${block.offset}`,
      school,
      offset: block.offset,
      max: block.max,
      examType: block.exam_type,
      edition: "historical",
      requiresConfirmation: blocks.length > 1,
      label: `${current.length ? "기존 교재 · " : ""}${school}${block.exam_type ? ` · ${block.exam_type}` : ""}${school.includes("+") ? " (학교 묶음)" : ""}`,
    }))
  ).sort((a, b) => a.school.localeCompare(b.school, "ko"));
  return [...current, ...historical];
}

export function examOptions(book: string) {
  // Keep mixed historical sections for old-record display, but do not offer
  // them for new student submissions or explanation selection.
  return allExamOptions(book).filter((option) => !option.examType.includes("여러 학교 뒤섞임"));
}

export function examIncludesSchool(examSchool: string, studentSchool: string) {
  const normalizedStudent = studentSchool.replace(/\s+/g, "").replace(/고등학교$/, "고");
  if (!normalizedStudent) return false;
  const names = examSchool.replace(/^\d{2,4}(?:·\d{2,4})?\s+/, "").split("+");
  return names.some((name) => normalizedStudent.endsWith(name.replace(/\s+/g, "")));
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
  const options = allExamOptions(book);
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
