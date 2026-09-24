import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { getSession } from "../../../../lib/session";

const ALL_TEACHER_ADMIN = "전체 관리자";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const teacher = session.name;

    const supabase = getServerSupabase();

    let rosterQuery = supabase.from("student_roster").select("*").order("created_at", { ascending: false });
    if (teacher !== ALL_TEACHER_ADMIN) rosterQuery = rosterQuery.eq("teacher_name", teacher);
    const rosterRes = await rosterQuery;
    if (rosterRes.error) throw rosterRes.error;

    const studentNames = Array.from(new Set((rosterRes.data || []).map((row: any) => row.student_name).filter(Boolean)));

    let wrongAnswers: any[] = [];
    let wrongNoteFiles: any[] = [];

    if (teacher === ALL_TEACHER_ADMIN) {
      const [wrongRes, filesRes] = await Promise.all([
        supabase.from("wrong_answers").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("wrong_note_files").select("*").order("uploaded_at", { ascending: false }).limit(1000),
      ]);
      if (wrongRes.error) throw wrongRes.error;
      if (filesRes.error) throw filesRes.error;
      wrongAnswers = wrongRes.data || [];
      wrongNoteFiles = filesRes.data || [];
    } else if (studentNames.length) {
      const [wrongRes, filesRes] = await Promise.all([
        supabase.from("wrong_answers").select("*").in("username", studentNames).order("created_at", { ascending: false }).limit(2000),
        supabase.from("wrong_note_files").select("*").eq("teacher_name", teacher).order("uploaded_at", { ascending: false }).limit(1000),
      ]);
      if (wrongRes.error) throw wrongRes.error;
      if (filesRes.error) throw filesRes.error;
      wrongAnswers = wrongRes.data || [];
      wrongNoteFiles = filesRes.data || [];
    }

    const reportQuery = teacher === ALL_TEACHER_ADMIN
      ? supabase.from("submission_report_history").select("*").order("cutoff_at", { ascending: false }).limit(100)
      : supabase.from("submission_report_history").select("*").eq("teacher_name", teacher).order("cutoff_at", { ascending: false }).limit(100);
    const reportRes = await reportQuery;
    if (reportRes.error) throw reportRes.error;

    return NextResponse.json({
      ok: true,
      roster: rosterRes.data || [],
      wrongAnswers,
      wrongNoteFiles,
      reports: reportRes.data || [],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: "선생님 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
