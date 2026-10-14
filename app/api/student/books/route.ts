import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { examOptions } from "../../../../lib/wrong-answers";

const fallbackBooks = ["공통수학2 고쟁이", "공통수학2 RPM", "미적분1 고쟁이", "확통 고쟁이", "미적분2 쎈", "X-패턴 미적분2", "기하 쎈", "마플교과서 공통수학1", "공통수학1 RPM"];

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (session?.role !== "student") return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const db = getServerSupabase();
    const result = await db.from("book_master").select("book_name").eq("is_active", true).order("book_name");
    const books = result.error || !result.data?.length ? fallbackBooks : [...new Set(result.data.map((row) => String(row.book_name || "").trim()).filter(Boolean))];
    return NextResponse.json({ books, exams: Object.fromEntries(books.map((book) => [book, examOptions(book)])) });
  } catch (error) {
    console.error("[student books] failed", error);
    return NextResponse.json({ message: "교재 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
