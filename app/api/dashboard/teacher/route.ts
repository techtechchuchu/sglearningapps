import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { getSession } from "../../../../lib/session";
import { fetchPagedRows } from "../../../../lib/paged-rows";

const ALL_TEACHER_ADMIN = "전체 관리자";

export async function GET(request: NextRequest) {
  let stage = "session";
  try {
    const session = getSession(request);
    if (!session || session.role !== "teacher") {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const teacher = session.name;

    stage = "supabase-client";
    const supabase = getServerSupabase();

    stage = "roster";
    const roster = await fetchPagedRows((start, end) => {
      let query = supabase.from("student_roster").select("*").order("created_at", { ascending: false });
      if (teacher !== ALL_TEACHER_ADMIN) query = query.eq("teacher_name", teacher);
      return query.range(start, end);
    });
    const studentNames = Array.from(new Set(roster.map((row) => row.student_name).filter(Boolean)));

    let wrongAnswers: any[] = [];
    let wrongNoteFiles: any[] = [];

    if (teacher === ALL_TEACHER_ADMIN) {
      stage = "wrong-answers-and-files";
      [wrongAnswers, wrongNoteFiles] = await Promise.all([
        fetchPagedRows((start, end) => supabase.from("wrong_answers").select("*").order("created_at", { ascending: false }).range(start, end)),
        fetchPagedRows((start, end) => supabase.from("wrong_note_files").select("*").order("uploaded_at", { ascending: false }).range(start, end)),
      ]);
    } else if (studentNames.length) {
      stage = "teacher-answers-and-files";
      const chunks = Array.from({ length: Math.ceil(studentNames.length / 100) }, (_, index) => studentNames.slice(index * 100, index * 100 + 100));
      const [answersByChunk, files] = await Promise.all([
        Promise.all(chunks.map((names) => fetchPagedRows((start, end) => supabase.from("wrong_answers").select("*").in("username", names).order("created_at", { ascending: false }).range(start, end)))),
        fetchPagedRows((start, end) => supabase.from("wrong_note_files").select("*").eq("teacher_name", teacher).order("uploaded_at", { ascending: false }).range(start, end)),
      ]);
      wrongAnswers = answersByChunk.flat().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      wrongNoteFiles = files;
    }

    const reportQuery = teacher === ALL_TEACHER_ADMIN
      ? supabase.from("submission_report_history").select("*").order("cutoff_at", { ascending: false }).limit(100)
      : supabase.from("submission_report_history").select("*").eq("teacher_name", teacher).order("cutoff_at", { ascending: false }).limit(100);
    stage = "reports-print-school-users-books";
    const [reportRes, printStatus, schoolWrongAnswers, resetRes, users, examsRes, booksRes] = await Promise.all([
      reportQuery,
      fetchPagedRows((start, end) => teacher === ALL_TEACHER_ADMIN
        ? supabase.from("print_status").select("*").order("id", { ascending: false }).range(start, end)
        : supabase.from("print_status").select("*").eq("teacher_name", teacher).order("id", { ascending: false }).range(start, end)),
      teacher === ALL_TEACHER_ADMIN
        ? fetchPagedRows((start, end) => supabase.from("school_exam_wrong_answers").select("*").order("created_at", { ascending: false }).range(start, end))
        : studentNames.length
          ? Promise.all(Array.from({ length: Math.ceil(studentNames.length / 100) }, (_, index) => studentNames.slice(index * 100, index * 100 + 100)).map((names) => fetchPagedRows((start, end) => supabase.from("school_exam_wrong_answers").select("*").in("username", names).order("created_at", { ascending: false }).range(start, end)))).then((groups) => groups.flat().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))))
          : Promise.resolve([]),
      supabase.from("password_reset_requests").select("id,username,status,requested_at,processed_at,processed_by").eq("status", "pending").order("requested_at", { ascending: false }).limit(500),
      fetchPagedRows((start, end) => supabase.from("users").select("username,grade,created_at").order("created_at", { ascending: false }).range(start, end)),
      supabase.from("school_exam_master").select("id,display_name,school_name,exam_year,exam_type,question_count").limit(1000),
      supabase.from("book_master").select("book_name").eq("is_active", true).order("book_name").limit(2000),
    ]);
    const firstError = reportRes.error || resetRes.error || examsRes.error || booksRes.error;
    if (firstError) throw firstError;
    const allowed = new Set(studentNames);

    return NextResponse.json({
      ok: true,
      roster,
      wrongAnswers,
      wrongNoteFiles,
      reports: reportRes.data || [],
      printStatus,
      schoolWrongAnswers,
      schoolExams: examsRes.data || [],
      activeBooks: (booksRes.data || []).map((row) => row.book_name),
      resetRequests: teacher === ALL_TEACHER_ADMIN ? resetRes.data || [] : (resetRes.data || []).filter((row) => allowed.has(row.username)),
      users: teacher === ALL_TEACHER_ADMIN ? users : users.filter((row) => allowed.has(row.username)),
    });
  } catch (error) {
    console.error(`[teacher dashboard] failed at ${stage}`, error);
    return NextResponse.json({ ok: false, message: "선생님 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}

