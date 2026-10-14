import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { normalizeSubmittedNumbers, parseProblemNumbers } from "../../../../lib/wrong-answers";
import { FALLBACK_BOOKS } from "../../../../lib/fallback-books";

function ownSession(request: NextRequest) {
  const session = getSession(request);
  return session?.role === "student" ? session.name : null;
}

async function existingNumbers(db: ReturnType<typeof getServerSupabase>, username: string, book: string, skipId?: number) {
  const found = new Set<string>();
  for (let start = 0; ; start += 1000) {
    const result = await db.from("wrong_answers").select("id,problem").eq("username", username).eq("unit", book).range(start, start + 999);
    if (result.error) throw result.error;
    for (const row of result.data || []) {
      if (Number(row.id) === skipId) continue;
      try { for (const number of parseProblemNumbers(row.problem)) found.add(number); } catch { /* Ignore malformed legacy entries. */ }
    }
    if ((result.data || []).length < 1000) break;
  }
  return found;
}

export async function POST(request: NextRequest) {
  try {
    const username = ownSession(request);
    if (!username) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const input = await request.json();
    const book = String(input.book || "").trim();
    if (!book || input.bookConfirmed !== true) return NextResponse.json({ message: "교재를 선택하고 확인해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const activeBook = await db.from("book_master").select("id").eq("book_name", book).eq("is_active", true).limit(1);
    if (activeBook.error || !activeBook.data?.length) {
      const catalogue = await db.from("book_master").select("id").limit(1);
      if ((catalogue.error || !catalogue.data?.length) && FALLBACK_BOOKS.includes(book)) {
        // The old app permits its built-in books before book_master is populated.
      } else {
        return NextResponse.json({ message: "현재 사용 중인 교재를 선택해주세요." }, { status: 400 });
      }
    }
    const normalized = normalizeSubmittedNumbers(book, input.problem, input.examId, input.examConfirmed === true);
    const existing = await existingNumbers(db, username, book);
    const fresh = normalized.numbers.filter((number) => !existing.has(number));
    const duplicate = normalized.numbers.filter((number) => existing.has(number));
    if (!fresh.length) return NextResponse.json({ message: "입력한 문제번호가 모두 이미 저장되어 있습니다.", duplicate }, { status: 409 });
    const memo = [normalized.memoPrefix, String(input.memo || "").trim(), input.requestVariant === true ? "[변형문제 요청]" : ""].filter(Boolean).join(" ");
    const payload = { username, unit: book, problem: fresh.join(", "), memo, created_at: new Date().toISOString() };
    const inserted = await db.from("wrong_answers").insert(payload).select("id,username,unit,problem,memo,created_at").single();
    if (inserted.error) throw inserted.error;
    const verified = await db.from("wrong_answers").select("id,username,unit,problem,memo,created_at").eq("id", inserted.data.id).eq("username", username).single();
    if (verified.error || verified.data.problem !== payload.problem || verified.data.unit !== book) {
      console.error("[wrong answer save] verification failed", verified.error);
      return NextResponse.json({ message: "저장 결과를 확인하지 못했습니다. 새로고침해 목록을 확인해주세요." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, saved: fresh, duplicate, row: verified.data }, { status: 201 });
  } catch (error) {
    console.error("[wrong answer save] failed", error);
    const message = error instanceof Error && /문제번호|학교|시험/.test(error.message) ? error.message : "오답을 저장하지 못했습니다.";
    return NextResponse.json({ message }, { status: /문제번호|학교|시험/.test(message) ? 400 : 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const username = ownSession(request);
    if (!username) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const input = await request.json();
    const id = Number(input.id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ message: "오답 기록을 선택해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const own = await db.from("wrong_answers").select("id,unit,problem,memo").eq("id", id).eq("username", username).single();
    if (own.error) return NextResponse.json({ message: "수정할 기록을 찾지 못했습니다." }, { status: 404 });
    const book = String(input.book || own.data.unit).trim();
    let nextProblem = String(own.data.problem);
    if (input.problem !== undefined || book !== own.data.unit) {
      const normalized = normalizeSubmittedNumbers(book, input.problem, input.examId, input.examConfirmed === true);
      const existing = await existingNumbers(db, username, book, id);
      if (normalized.numbers.some((number) => existing.has(number))) return NextResponse.json({ message: "이미 저장된 문제번호가 포함되어 있습니다." }, { status: 409 });
      nextProblem = normalized.numbers.join(", ");
    }
    const memo = String(input.memo ?? own.data.memo).trim();
    const updated = await db.from("wrong_answers").update({ unit: book, problem: nextProblem, memo }).eq("id", id).eq("username", username).select("id,unit,problem,memo").single();
    if (updated.error) throw updated.error;
    return NextResponse.json({ ok: true, row: updated.data });
  } catch (error) {
    console.error("[wrong answer edit] failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "수정하지 못했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const username = ownSession(request);
    if (!username) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    const id = Number((await request.json()).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ message: "삭제할 기록을 선택해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const removed = await db.from("wrong_answers").delete().eq("id", id).eq("username", username).select("id");
    if (removed.error) throw removed.error;
    if (!removed.data?.length) return NextResponse.json({ message: "기록을 찾지 못했습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[wrong answer delete] failed", error);
    return NextResponse.json({ message: "삭제하지 못했습니다." }, { status: 500 });
  }
}
