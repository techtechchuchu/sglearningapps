import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../lib/active-session";
import { getServerSupabase } from "../../../lib/supabase-server";
import { bookExamOptions, explanationKey, safeImageUrl, youtubeId, youtubeStartFromUrl, youtubeStartSeconds, type ExplanationKind } from "../../../lib/problem-explanations";
import { FALLBACK_BOOKS } from "../../../lib/fallback-books";
import { canViewProblemExplanations, explanationBooksForStudent, explanationSubject, explanationSubjectsForStudent } from "../../../lib/problem-explanation-access";

const headers = { "Cache-Control": "private, no-store" };
const BASE_COLUMNS = "content_key,title,youtube_video_id,image_url";
const COLUMNS = `${BASE_COLUMNS},youtube_start_seconds`;

// The start-time column is installed by a separate migration; until then the feature degrades to "play from the beginning".
function startColumnMissing(error: { code?: string; message?: string } | null) {
  return !!error && ["42703", "PGRST204"].includes(error.code || "") && String(error.message || "").includes("youtube_start_seconds");
}

function inputFrom(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const book = request.nextUrl.searchParams.get("book") || "";
  const examId = request.nextUrl.searchParams.get("examId") || "";
  if (kind !== "xpattern" && kind !== "school") throw new Error("시험 종류를 확인해주세요.");
  return { kind: kind as ExplanationKind, book, examId };
}

async function maxForExam(db: ReturnType<typeof getServerSupabase>, kind: ExplanationKind, book: string, examId: string) {
  if (kind === "xpattern") {
    const exam = bookExamOptions(book).find((option) => option.id === examId);
    if (!exam) throw new Error("등록된 X-패턴 시험을 선택해주세요.");
    return exam.max;
  }
  const result = await db.from("school_exam_master").select("id,question_count").eq("id", Number(examId)).eq("is_active", true).single();
  if (result.error || !result.data) throw new Error("등록된 학교·시험을 선택해주세요.");
  const count = Number(result.data.question_count);
  return Number.isSafeInteger(count) && count > 0 ? Math.min(count, 200) : 20;
}

async function knownBook(db: ReturnType<typeof getServerSupabase>, book: string) {
  if (!book) return false;
  if (FALLBACK_BOOKS.includes(book)) return true;
  const result = await db.from("book_master").select("book_name").eq("book_name", book).eq("is_active", true).limit(1);
  if (result.error) throw result.error;
  return !!result.data?.length;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (!session || (session.role !== "student" && session.role !== "teacher")) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const { kind, book, examId } = inputFrom(request);
    const db = getServerSupabase();
    if (session.role === "student") {
      const roster = await db.from("student_roster")
        .select("teacher_name,class_name,enrollment_status,book_name,grade")
        .eq("student_name", session.name);
      if (roster.error) throw roster.error;
      if (!canViewProblemExplanations(session.name, roster.data || [])) {
        return NextResponse.json({ message: "이주백.T 담당 반 학생만 영상·손풀이를 볼 수 있습니다." }, { status: 403, headers });
      }
      if (session.name.trim() !== "추재현") {
        const classes = roster.data || [];
        if (kind === "xpattern" && !explanationBooksForStudent(session.name, classes, [book]).includes(book)) {
          return NextResponse.json({ message: "담당 반 교재의 해설만 볼 수 있습니다." }, { status: 403, headers });
        }
        if (kind === "school") {
          const exam = await db.from("school_exam_master").select("subject").eq("id", Number(examId)).eq("is_active", true).maybeSingle();
          if (exam.error) throw exam.error;
          const subject = explanationSubject(exam.data?.subject);
          if (!subject || !explanationSubjectsForStudent(session.name, classes).includes(subject)) {
            return NextResponse.json({ message: "담당 반 과목의 해설만 볼 수 있습니다." }, { status: 403, headers });
          }
        }
      }
    }
    if (kind === "xpattern" && !(await knownBook(db, book))) return NextResponse.json({ message: "현재 사용 중인 교재를 선택해주세요." }, { status: 400 });
    const max = await maxForExam(db, kind, book, examId);
    const keys = Array.from({ length: max }, (_, index) => explanationKey(kind, examId, index + 1, book));
    let result: { data: Record<string, unknown>[] | null; error: { code?: string; message?: string } | null } = await db.from("problem_explanations").select(COLUMNS).in("content_key", keys);
    if (startColumnMissing(result.error)) result = await db.from("problem_explanations").select(BASE_COLUMNS).in("content_key", keys);
    if (result.error) {
      // The independent table is installed separately; existing student features must stay usable meanwhile.
      if (["PGRST205", "42P01"].includes(result.error.code || "")) return NextResponse.json({ explanations: [], available: false, max }, { headers });
      throw result.error;
    }
    return NextResponse.json({ explanations: result.data || [], available: true, max }, { headers });
  } catch (error) {
    console.error("[problem explanations] read failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "해설을 불러오지 못했습니다." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (session?.role !== "teacher") return NextResponse.json({ message: "선생님 로그인이 필요합니다." }, { status: 403 });
    const input = await request.json();
    const kind = input.kind as ExplanationKind;
    if (kind !== "xpattern" && kind !== "school") return NextResponse.json({ message: "시험 종류를 확인해주세요." }, { status: 400 });
    const book = String(input.book || "");
    const examId = String(input.examId || "");
    const number = Number(input.number);
    const title = String(input.title || "").trim().slice(0, 200);
    const video = youtubeId(input.youtubeUrl);
    const image = safeImageUrl(input.imageUrl);
    // An explicitly typed start time wins; otherwise use the timestamp inside the shared link.
    const start = video ? (youtubeStartSeconds(input.startTime) ?? youtubeStartFromUrl(input.youtubeUrl)) : null;
    const db = getServerSupabase();
    if (kind === "xpattern" && !(await knownBook(db, book))) return NextResponse.json({ message: "현재 사용 중인 교재를 선택해주세요." }, { status: 400 });
    const max = await maxForExam(db, kind, book, examId);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) return NextResponse.json({ message: `문제번호는 1~${max}번입니다.` }, { status: 400 });
    const key = explanationKey(kind, examId, number, book);
    const row = { content_key: key, title, youtube_video_id: video, image_url: image, updated_by: session.name, updated_at: new Date().toISOString() };
    let saved: { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null } = await db.from("problem_explanations").upsert({ ...row, youtube_start_seconds: start }, { onConflict: "content_key" }).select(COLUMNS).single();
    if (startColumnMissing(saved.error)) {
      if (start !== null) return NextResponse.json({ message: "시작 시간 저장 공간이 아직 설치되지 않았습니다. 시작 시간을 비우고 저장하거나 관리자에게 문의해주세요." }, { status: 503, headers });
      saved = await db.from("problem_explanations").upsert(row, { onConflict: "content_key" }).select(BASE_COLUMNS).single();
    }
    if (saved.error) throw saved.error;
    return NextResponse.json({ ok: true, explanation: saved.data }, { headers });
  } catch (error) {
    console.error("[problem explanations] save failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "해설을 저장하지 못했습니다." }, { status: 500, headers });
  }
}

