import { FINAL_TERM_BOOKS } from "./book-periods";
import { splitRosterBooks } from "./wrong-answers";

type RosterAssignment = {
  teacher_name?: unknown;
  class_name?: unknown;
  enrollment_status?: unknown;
  book_name?: unknown;
  grade?: unknown;
};

export const EXPLANATION_SUBJECTS = ["공통수학2", "미적분1", "기하", "확통", "미적분2"] as const;
export type ExplanationSubject = (typeof EXPLANATION_SUBJECTS)[number];

export function explanationSubject(value: unknown): ExplanationSubject | null {
  const label = String(value || "").replace(/\s/g, "");
  if (label.includes("공통수학2")) return "공통수학2";
  if (label.includes("미적분1")) return "미적분1";
  if (label.includes("미적분2")) return "미적분2";
  if (label.includes("기하")) return "기하";
  if (label.includes("확통") || label.includes("확률과통계")) return "확통";
  return null;
}

function leeClassRows(roster: RosterAssignment[]) {
  return roster.filter((row) =>
    String(row.teacher_name || "").replace(/[^가-힣]/g, "") === "이주백" &&
    String(row.class_name || "").trim().length > 0 &&
    String(row.enrollment_status || "").trim() === "재원"
  );
}

// The roster stores teacher names with several suffixes (for example, 이주백.T).
export function hasLeeJubaekClass(roster: RosterAssignment[]): boolean {
  return leeClassRows(roster).length > 0;
}

export function canViewProblemExplanations(studentName: string, roster: RosterAssignment[]): boolean {
  return studentName.trim() === "추재현" || hasLeeJubaekClass(roster);
}

export function explanationSubjectsForStudent(studentName: string, roster: RosterAssignment[]): ExplanationSubject[] {
  if (studentName.trim() === "추재현") return [...EXPLANATION_SUBJECTS];
  const selected = new Set(leeClassRows(roster).flatMap((row) =>
    splitRosterBooks(row.book_name).map(explanationSubject).filter((subject): subject is ExplanationSubject => subject !== null)
  ));
  return EXPLANATION_SUBJECTS.filter((subject) => selected.has(subject));
}

export function explanationBooksForStudent(studentName: string, roster: RosterAssignment[], catalogue: string[]): string[] {
  if (studentName.trim() === "추재현") return catalogue;
  const classes = leeClassRows(roster);
  const assigned = new Set(classes.flatMap((row) => splitRosterBooks(row.book_name)));
  // Only the final edition of a book explicitly assigned to this student is equivalent.
  for (const book of [...assigned]) {
    const finalEdition = `${book} 기말`;
    if (FINAL_TERM_BOOKS.some((item) => item === finalEdition)) assigned.add(finalEdition);
  }
  return catalogue.filter((book) => assigned.has(book));
}

