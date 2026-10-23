import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/session";
import { sameOrigin } from "../../../../lib/member-auth";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { fetchPagedRows } from "../../../../lib/paged-rows";

const BUCKET = "wrong-note-pdfs";

function expired(withdrawnAt: string | null) {
  if (!withdrawnAt) return false;
  const date = new Date(withdrawnAt);
  if (Number.isNaN(date.getTime())) return false;
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.getTime() <= Date.now();
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 403 });
  const session = getSession(request);
  if (session?.role !== "teacher" || session.name !== "전체 관리자") {
    return NextResponse.json({ message: "전체 관리자만 이용할 수 있습니다." }, { status: 403 });
  }
  try {
    const input = await request.json();
    if (input.confirmation !== "영구삭제" || !["student", "member"].includes(input.kind)) {
      return NextResponse.json({ message: "삭제 확인을 다시 해주세요." }, { status: 400 });
    }
    const db = getServerSupabase();
    const key = String(input.key || "").trim();
    if (!key || key.length > 254) return NextResponse.json({ message: "계정 정보가 올바르지 않습니다." }, { status: 400 });

    if (input.kind === "member") {
      if (!/^[0-9a-f-]{36}$/i.test(key)) return NextResponse.json({ message: "계정 정보가 올바르지 않습니다." }, { status: 400 });
      const account = await db.from("university_users").select("id,withdrawn_at").eq("id", key).maybeSingle();
      if (account.error) throw account.error;
      if (!account.data || !expired(account.data.withdrawn_at)) return NextResponse.json({ message: "보관 기간이 끝나지 않았습니다." }, { status: 409 });
      const identities = await db.from("sg_identities").delete().eq("target_role", "member").eq("target_key", key);
      if (identities.error) throw identities.error;
      const removed = await db.from("university_users").delete().eq("id", key).eq("withdrawn_at", account.data.withdrawn_at).select("id");
      // The date was checked above. The extra predicate protects against a concurrent status change.
      if (removed.error) throw removed.error;
      if (!removed.data?.length) return NextResponse.json({ message: "삭제 대상 상태가 변경됐습니다. 다시 확인해주세요." }, { status: 409 });
      return NextResponse.json({ ok: true, message: "탈퇴 계정과 연결된 개인 학습 기록을 삭제했습니다." });
    }

    const account = await db.from("users").select("username,withdrawn_at").eq("username", key).maybeSingle();
    if (account.error) throw account.error;
    if (!account.data || !expired(account.data.withdrawn_at)) return NextResponse.json({ message: "보관 기간이 끝나지 않았습니다." }, { status: 409 });
    // Legacy attendance, questions and PDFs only have names, not account IDs. Never
    // purge name-linked records when multiple roster rows could belong to namesakes.
    const [roster, linked] = await Promise.all([
      db.from("student_roster").select("id").eq("student_name", key).limit(2),
      db.from("university_users").select("id").eq("academy_username", key).is("withdrawn_at", null).limit(1),
    ]);
    if (roster.error || linked.error) throw roster.error || linked.error;
    if (roster.data?.length !== 1 || linked.data?.length) {
      return NextResponse.json({ message: "동명이인·복수 명단 또는 연결 계정 가능성이 있어 자동 삭제하지 않았습니다. 명단과 소유 기록을 먼저 확인해주세요." }, { status: 409 });
    }
    const files = await fetchPagedRows((start, end) => db.from("wrong_note_files").select("id,storage_path").eq("student_name", key).range(start, end));
    for (let index = 0; index < files.length; index += 1000) {
      const paths = files.slice(index, index + 1000).map((row) => row.storage_path).filter(Boolean);
      if (paths.length) {
        const removed = await db.storage.from(BUCKET).remove(paths);
        if (removed.error) throw removed.error;
      }
    }
    for (const [table, column] of [
      ["wrong_note_files", "student_name"], ["attendance_records", "student_name"],
      ["student_questions", "student_name"], ["school_exam_wrong_answers", "username"],
      ["wrong_answers", "username"], ["password_reset_requests", "username"],
    ] as const) {
      const removed = await db.from(table).delete().eq(column, key);
      if (removed.error) throw removed.error;
    }
    const identities = await db.from("sg_identities").delete().eq("target_role", "student").eq("target_key", key);
    if (identities.error) throw identities.error;
    const removed = await db.from("users").delete().eq("username", key).eq("withdrawn_at", account.data.withdrawn_at).select("username");
    if (removed.error) throw removed.error;
    if (!removed.data?.length) return NextResponse.json({ message: "삭제 대상 상태가 변경됐습니다. 다시 확인해주세요." }, { status: 409 });
    return NextResponse.json({ ok: true, message: "탈퇴 계정과 개인 오답·질문·출석·PDF 기록을 삭제했습니다. 학원 명단은 유지됩니다." });
  } catch (error) {
    console.error("[withdrawn account purge] failed", error);
    return NextResponse.json({ message: "삭제를 완료하지 못했습니다. 일부 단계가 처리됐을 수 있으니 기록을 확인한 뒤 다시 시도해주세요." }, { status: 500 });
  }
}
