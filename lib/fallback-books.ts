import { FINAL_TERM_BOOKS, MIDTERM_BOOKS } from "./book-periods";

// Keep the complete built-in catalogue available while book_master is being populated.
export const FALLBACK_BOOKS = [
  ...FINAL_TERM_BOOKS,
  ...MIDTERM_BOOKS,
  "마플교과서 공통수학1",
  "공통수학1 RPM",
];

