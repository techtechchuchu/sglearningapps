import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { examOptions } from "../../../../lib/wrong-answers";
import { FALLBACK_BOOKS } from "../../../../lib/fallback-books";
import { sortBooksForDisplay } from "../../../../lib/book-periods";

export async function GET(request: NextRequest) {
  try {
    const session = getSession(request);
    if (session?.role !== "student") return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const db = getServerSupabase();
    const result = await db.from("book_master").select("book_name").eq("is_active", true).order("book_name");
    const databaseBooks = result.error ? [] : result.data?.map((row) => String(row.book_name || "").trim()).filter(Boolean) || [];
    const books = sortBooksForDisplay([...FALLBACK_BOOKS, ...databaseBooks]);
    return NextResponse.json({ books, exams: Object.fromEntries(books.map((book) => [book, examOptions(book)])) });
  } catch (error) {
    console.error("[student books] failed", error);
    return NextResponse.json({ message: "교재 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

