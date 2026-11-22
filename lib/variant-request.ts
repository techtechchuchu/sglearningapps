import { parseProblemNumbers } from "./wrong-answers";

type SavedRequest = { problem?: unknown; memo?: unknown };

export function variantRequestNumbers(memo: unknown): string[] | null {
  const match = String(memo || "").match(/\[변형문제 요청:\s*([\d,\s]+)번\]/);
  if (!match) return null;
  try { return parseProblemNumbers(match[1]); } catch { return null; }
}

export function matchesSavedVariantRequest(row: SavedRequest, submittedNumbers: string[], requestedNumbers: string[]): boolean {
  const requested = variantRequestNumbers(row.memo);
  if (!requested || requested.length !== requestedNumbers.length || !requestedNumbers.every((number) => requested.includes(number))) return false;
  try {
    const stored = parseProblemNumbers(row.problem);
    return stored.length === submittedNumbers.length && submittedNumbers.every((number) => stored.includes(number));
  } catch { return false; }
}
