export const BOOK_PERIODS = ["2학기 기말", "2학기 중간", "전체 교재"] as const;

export type BookPeriod = (typeof BOOK_PERIODS)[number];

export const FINAL_TERM_BOOKS = [
  "울산N제 공통수학2",
  "UNIT N제 공통수학2",
  "X-패턴 공통수학2",
  "백미 공통수학2",
  "X-패턴 미적분1",
  "X-패턴 미적분2",
  "X-패턴 확통",
  "기하끝",
  "X-패턴 기하",
] as const;

export const MIDTERM_BOOKS = [
  "공통수학2 고쟁이",
  "공통수학2 RPM",
  "미적분1 고쟁이",
  "확통 고쟁이",
  "미적분2 쎈",
  "기하 쎈",
] as const;

const finalRank = new Map<string, number>(FINAL_TERM_BOOKS.map((book, index) => [book, index]));
const midtermRank = new Map<string, number>(MIDTERM_BOOKS.map((book, index) => [book, index]));

export function bookPeriodOf(book: string): Exclude<BookPeriod, "전체 교재"> | "기타" {
  if (finalRank.has(book)) return "2학기 기말";
  if (midtermRank.has(book)) return "2학기 중간";
  return "기타";
}

export function sortBooksForDisplay(books: string[]) {
  return [...new Set(books.map((book) => book.trim()).filter(Boolean))].sort((left, right) => {
    const leftPeriod = bookPeriodOf(left);
    const rightPeriod = bookPeriodOf(right);
    const periodRank = { "2학기 기말": 0, "2학기 중간": 1, "기타": 2 } as const;
    if (leftPeriod !== rightPeriod) return periodRank[leftPeriod] - periodRank[rightPeriod];
    if (leftPeriod === "2학기 기말" && rightPeriod === "2학기 기말") return (finalRank.get(left) ?? 999) - (finalRank.get(right) ?? 999);
    if (leftPeriod === "2학기 중간" && rightPeriod === "2학기 중간") return (midtermRank.get(left) ?? 999) - (midtermRank.get(right) ?? 999);
    return left.localeCompare(right, "ko");
  });
}

export function filterBooksByPeriod(books: string[], period: BookPeriod) {
  const sorted = sortBooksForDisplay(books);
  if (period === "전체 교재") return sorted;
  return sorted.filter((book) => bookPeriodOf(book) === period);
}

type RosterBookRow = { class_name?: unknown; grade?: unknown };

const FINAL_BOOKS_BY_CLASS: Array<{ matches: string[]; books: string[] }> = [
  { matches: ["탑티어"], books: ["울산N제 공통수학2", "백미 공통수학2"] },
  { matches: ["내신심화"], books: ["UNIT N제 공통수학2", "X-패턴 공통수학2"] },
  { matches: ["드릴"], books: ["UNIT N제 공통수학2", "X-패턴 공통수학2"] },
  { matches: ["미적분1"], books: ["X-패턴 미적분1"] },
  { matches: ["확통", "확률과통계"], books: ["X-패턴 확통"] },
  { matches: ["기하"], books: ["기하끝", "X-패턴 기하"] },
  { matches: ["미적분2"], books: ["X-패턴 미적분2"] },
];

export function finalBooksForRoster(books: string[], roster: RosterBookRow[]) {
  const assigned = new Set<string>();
  for (const row of roster) {
    const classLabel = `${String(row.grade || "")} ${String(row.class_name || "")}`.replaceAll(" ", "");
    for (const rule of FINAL_BOOKS_BY_CLASS) {
      if (rule.matches.some((keyword) => classLabel.includes(keyword))) rule.books.forEach((book) => assigned.add(book));
    }
  }
  if (!assigned.size) return books;
  return books.filter((book) => assigned.has(book));
}

