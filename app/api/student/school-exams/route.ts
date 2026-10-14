import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { parseProblemNumbers } from "../../../../lib/wrong-answers";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (session?.role !== "student") return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const db = getServerSupabase();
    const [exams, answers] = await Promise.all([
      db.from("school_exam_master").select("id,exam_year,school_name,subject,exam_type,question_count,scope,display_name").eq("is_active", true).order("exam_year", { ascending: false }),
      db.from("school_exam_wrong_answers").select("id,exam_id,problem,memo,created_at").eq("username", session.name).order("created_at", { ascending: false }).limit(500),
    ]);
    if (exams.error || answers.error) throw exams.error || answers.error;
    return NextResponse.json({ exams: exams.data || [], answers: answers.data || [] });
  } catch (error) {
    console.error("[school exams] failed", error);
    return NextResponse.json({ message: "학교 기출 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSession(request);
    if (session?.role !== "student") return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const input = await request.json();
    const examId = Number(input.examId);
    if (!Number.isSafeInteger(examId) || input.confirmed !== true) return NextResponse.json({ message: "학교·시험을 선택하고 확인해주세요." }, { status: 400 });
    const numbers = parseProblemNumbers(input.problem);
    const db = getServerSupabase();
    const exam = await db.from("school_exam_master").select("id,question_count").eq("id", examId).eq("is_active", true).single();
    if (exam.error) return NextResponse.json({ message: "등록된 학교 기출을 선택해주세요." }, { status: 400 });
    if (exam.data.question_count && numbers.some((n) => Number(n) > Number(exam.data.question_count))) return NextResponse.json({ message: "시험 문항 수를 초과한 번호가 있습니다." }, { status: 400 });
    const existing = new Set<string>();
    for (let start = 0; ; start += 1000) {
      const rows = await db.from("school_exam_wrong_answers").select("problem").eq("username", session.name).eq("exam_id", examId).range(start, start + 999);
      if (rows.error) throw rows.error;
      for (const row of rows.data || []) try { parseProblemNumbers(row.problem).forEach((n) => existing.add(n)); } catch { /* legacy row */ }
      if ((rows.data || []).length < 1000) break;
    }
    const fresh = numbers.filter((n) => !existing.has(n));
    const duplicate = numbers.filter((n) => existing.has(n));
    if (!fresh.length) return NextResponse.json({ message: "모두 이미 저장된 문제번호입니다.", duplicate }, { status: 409 });
    const inserted = await db.from("school_exam_wrong_answers").insert({ username: session.name, exam_id: examId, problem: fresh.join(", "), memo: String(input.memo || "").trim(), source_type: "manual", source_filename: "", created_at: new Date().toISOString() }).select("id,problem").single();
    if (inserted.error) throw inserted.error;
    const verified = await db.from("school_exam_wrong_answers").select("id,problem").eq("id", inserted.data.id).eq("username", session.name).single();
    if (verified.error || verified.data.problem !== fresh.join(", ")) return NextResponse.json({ message: "저장 결과를 확인하지 못했습니다. 목록을 다시 확인해주세요." }, { status: 502 });
    return NextResponse.json({ ok: true, saved: fresh, duplicate, row: verified.data }, { status: 201 });
  } catch (error) {
    console.error("[school exam save] failed", error);
    return NextResponse.json({ message: error instanceof Error && error.message.includes("문제번호") ? error.message : "학교 기출 오답을 저장하지 못했습니다." }, { status: 500 });
  }
}
