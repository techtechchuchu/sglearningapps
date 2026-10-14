import { examOptions, splitRosterBooks } from "./wrong-answers";

export type ExplanationKind = "xpattern" | "school";
export type Explanation = {
  content_key: string;
  title: string;
  youtube_video_id: string | null;
  image_url: string | null;
};

export function explanationKey(kind: ExplanationKind, examId: string | number, number: number, book = "") {
  if (!Number.isSafeInteger(number) || number < 1 || number > 200) throw new Error("문제번호를 확인해주세요.");
  if (kind === "xpattern") {
    if (!book || !examOptions(book).some((option) => option.id === examId && number <= option.max)) throw new Error("교재·학교·시험을 확인해주세요.");
    return `xpattern:${encodeURIComponent(book)}:${encodeURIComponent(String(examId))}:${number}`;
  }
  if (!Number.isSafeInteger(Number(examId)) || Number(examId) < 1) throw new Error("학교·시험을 확인해주세요.");
  return `school:${Number(examId)}:${number}`;
}

export function youtubeId(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("유튜브 주소를 확인해주세요."); }
  if (url.protocol !== "https:") throw new Error("HTTPS 유튜브 주소만 등록할 수 있습니다.");
  const host = url.hostname.toLowerCase();
  const id = host === "youtu.be" ? url.pathname.slice(1) : ["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host) ? (url.searchParams.get("v") || (/^\/(?:embed|shorts)\/([\w-]{11})/.exec(url.pathname)?.[1] || "")) : "";
  if (!/^[\w-]{11}$/.test(id)) throw new Error("유튜브 영상 주소를 확인해주세요.");
  return id;
}

export function safeImageUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.toString();
  } catch { throw new Error("해설 이미지는 HTTPS 이미지 주소를 입력해주세요."); }
}

export function assignedBook(roster: Array<Record<string, unknown>>, book: string) {
  return roster.some((row) => row.enrollment_status !== "퇴원" && splitRosterBooks(row.book_name).includes(book));
}

