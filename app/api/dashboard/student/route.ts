import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { getActiveSession } from "../../../../lib/active-session";
import { fetchPagedRows } from "../../../../lib/paged-rows";

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (!session || session.role !== "student") {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const username = session.name;

    const supabase = getServerSupabase();
    const [rosterRes, wrongRes, filesRes, noticesRes, userRes] = await Promise.all([
      supabase.from("student_roster").select("*").eq("student_name", username).order("created_at", { ascending: false }),
      fetchPagedRows((start, end) => supabase.from("wrong_answers").select("*").eq("username", username).order("created_at", { ascending: false }).range(start, end)),
      supabase.from("wrong_note_files").select("*").eq("student_name", username).order("uploaded_at", { ascending: false }).limit(100),
      supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("users").select("username,grade,temp_password").eq("username", username).single(),
    ]);

    const firstError = rosterRes.error || filesRes.error || noticesRes.error || userRes.error;
    if (firstError) throw firstError;

    return NextResponse.json({
      ok: true,
      roster: rosterRes.data || [],
      wrongAnswers: wrongRes,
      wrongNoteFiles: filesRes.data || [],
      notices: noticesRes.data || [],
      mustChangePassword: Boolean(String(userRes.data?.temp_password || "").trim()),
      grade: userRes.data?.grade || "",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: "학생 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
