import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";

export async function PATCH(request: NextRequest) {
  try {
    const teacher = staffSession(request);
    if (!teacher) return NextResponse.json({ message: "선생님 로그인이 필요합니다." }, { status: 401 });
    const { id, isPrinted, memo } = await request.json();
    const recordId = Number(id);
    if (!Number.isSafeInteger(recordId) || recordId <= 0) return NextResponse.json({ message: "출력 기록을 선택해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const existing = await db.from("print_status").select("id,teacher_name").eq("id", recordId).single();
    if (existing.error) return NextResponse.json({ message: "출력 기록을 찾지 못했습니다." }, { status: 404 });
    if (teacher !== "전체 관리자" && existing.data.teacher_name !== teacher) return NextResponse.json({ message: "담당 출력 기록만 변경할 수 있습니다." }, { status: 403 });
    const payload: Record<string, unknown> = {};
    if (typeof isPrinted === "boolean") { payload.is_printed = isPrinted; payload.printed_at = isPrinted ? new Date().toISOString() : null; }
    if (memo !== undefined) payload.memo = String(memo || "").trim();
    if (!Object.keys(payload).length) return NextResponse.json({ message: "변경할 내용이 없습니다." }, { status: 400 });
    const updated = await db.from("print_status").update(payload).eq("id", recordId).select("*").single();
    if (updated.error) throw updated.error;
    return NextResponse.json({ ok: true, row: updated.data });
  } catch (error) {
    console.error("[print status] failed", error);
    return NextResponse.json({ message: "출력 상태를 변경하지 못했습니다." }, { status: 500 });
  }
}
