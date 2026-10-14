import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { getServerSupabase } from "../../../lib/supabase-server";
import { assignedBook, explanationKey, safeImageUrl, youtubeId, type ExplanationKind } from "../../../lib/problem-explanations";
import { examOptions } from "../../../lib/wrong-answers";

const headers = { "Cache-Control": "private, no-store" };

function inputFrom(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const book = request.nextUrl.searchParams.get("book") || "";
  const examId = request.nextUrl.searchParams.get("examId") || "";
  if (kind !== "xpattern" && kind !== "school") throw new Error("시험 종류를 확인해주세요.");
  return { kind: kind as ExplanationKind, book, examId };
}

async function maxForExam(db: ReturnType<typeof getServerSupabase>, kind: ExplanationKind, book: string, examId: string) {
  if (kind === "xpattern") {
    const exam = examOptions(book).find((option) => option.id === examId);
    if (!exam) throw new Error("등록된 X-패턴 시험을 선택해주세요.");
    return exam.max;
  }
  const result = await db.from("school_exam_master").select("id,question_count").eq("id", Number(examId)).eq("is_active", true).single();
  if (result.error || !result.data) throw new Error("등록된 학교·시험을 선택해주세요.");
  const count = Number(result.data.question_count);
  return Number.isSafeInteger(count) && count > 0 ? Math.min(count, 200) : 20;
}

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session || (session.role !== "student" && session.role !== "teacher")) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const { kind, book, examId } = inputFrom(request);
    const db = getServerSupabase();
    if (session.role === "student" && kind === "xpattern") {
      const roster = await db.from("student_roster").select("book_name,enrollment_status").eq("student_name", session.name);
      if (roster.error) throw roster.error;
      if (!assignedBook(roster.data || [], book)) return NextResponse.json({ message: "명단에 등록된 교재만 볼 수 있습니다." }, { status: 403 });
    }
    const max = await maxForExam(db, kind, book, examId);
    const keys = Array.from({ length: max }, (_, index) => explanationKey(kind, examId, index + 1, book));
    const result = await db.from("problem_explanations").select("content_key,title,youtube_video_id,image_url").in("content_key", keys);
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
    const session = getSession(request);
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
    if (!video && !image) return NextResponse.json({ message: "유튜브 주소 또는 해설 이미지 주소를 입력해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const max = await maxForExam(db, kind, book, examId);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) return NextResponse.json({ message: `문제번호는 1~${max}번입니다.` }, { status: 400 });
    const key = explanationKey(kind, examId, number, book);
    const saved = await db.from("problem_explanations").upsert({ content_key: key, title, youtube_video_id: video, image_url: image, updated_by: session.name, updated_at: new Date().toISOString() }, { onConflict: "content_key" }).select("content_key,title,youtube_video_id,image_url").single();
    if (saved.error) throw saved.error;
    return NextResponse.json({ ok: true, explanation: saved.data }, { headers });
  } catch (error) {
    console.error("[problem explanations] save failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "해설을 저장하지 못했습니다." }, { status: 500, headers });
  }
}

