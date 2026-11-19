import { examOptions } from "./wrong-answers";

export type ExplanationKind = "xpattern" | "school";
export type Explanation = {
  content_key: string;
  title: string;
  youtube_video_id: string | null;
  youtube_start_seconds?: number | null;
  image_url: string | null;
};

const MAX_START_SECONDS = 12 * 60 * 60;

export function bookExamOptions(book: string) {
  const mapped = examOptions(book);
  return mapped.length ? mapped : [{ id: "book", school: "교재 전체", offset: 0, max: 20, examType: "", requiresConfirmation: false, label: "1~20번" }];
}

export function explanationKey(kind: ExplanationKind, examId: string | number, number: number, book = "") {
  if (!Number.isSafeInteger(number) || number < 1 || number > 200) throw new Error("문제번호를 확인해주세요.");
  if (kind === "xpattern") {
    if (!book || !bookExamOptions(book).some((option) => option.id === examId && number <= option.max)) throw new Error("교재·학교·시험을 확인해주세요.");
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

// Accepts "754", "12:34", "1:02:03", "12m34s" and "1h2m3s". Empty or zero means "from the beginning".
export function youtubeStartSeconds(value: unknown): number | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  let seconds: number | null = null;
  const clock = /^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(raw);
  const units = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
  if (clock) seconds = clock[3] === undefined ? Number(clock[1]) * 60 + Number(clock[2]) : Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  else if (units) seconds = Number(units[1] || 0) * 3600 + Number(units[2] || 0) * 60 + Number(units[3] || 0);
  if (seconds === null || !Number.isSafeInteger(seconds) || seconds > MAX_START_SECONDS) throw new Error("시작 시간은 12:34 또는 1:02:03 형식으로 입력해주세요.");
  return seconds || null;
}

// Reads the timestamp YouTube puts in shared links (?t=754, &t=12m34s, ?start=754).
export function youtubeStartFromUrl(value: unknown): number | null {
  try {
    const url = new URL(String(value || "").trim());
    return youtubeStartSeconds(url.searchParams.get("t") || url.searchParams.get("start") || "");
  } catch { return null; }
}

export function formatYoutubeStart(seconds: number | null | undefined): string {
  const total = Number(seconds);
  if (!Number.isSafeInteger(total) || total <= 0) return "";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function youtubeEmbedUrl(videoId: string, startSeconds?: number | null): string {
  const start = Number(startSeconds);
  return `https://www.youtube-nocookie.com/embed/${videoId}${Number.isSafeInteger(start) && start > 0 ? `?start=${start}` : ""}`;
}

export function safeImageUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  // Hand-solution crops served from the private bucket through our own route.
  if (/^\/api\/files\/problem-solution\/[a-z0-9-]{3,80}\/\d{2}\.webp$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.toString();
  } catch { throw new Error("해설 이미지는 HTTPS 이미지 주소를 입력해주세요."); }
}


