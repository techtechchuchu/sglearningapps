import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { getSession } from "../../../../lib/session";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (!session || session.role !== "student") {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
    }
    const username = session.name;

    const supabase = getServerSupabase();
    const [rosterRes, wrongRes, filesRes, noticesRes] = await Promise.all([
      supabase.from("student_roster").select("*").eq("student_name", username).order("created_at", { ascending: false }),
      supabase.from("wrong_answers").select("*").eq("username", username).order("created_at", { ascending: false }).limit(500),
      supabase.from("wrong_note_files").select("*").eq("student_name", username).order("uploaded_at", { ascending: false }).limit(100),
      supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    const firstError = rosterRes.error || wrongRes.error || filesRes.error || noticesRes.error;
    if (firstError) throw firstError;

    return NextResponse.json({
      ok: true,
      roster: rosterRes.data || [],
      wrongAnswers: wrongRes.data || [],
      wrongNoteFiles: filesRes.data || [],
      notices: noticesRes.data || [],
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: "학생 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
