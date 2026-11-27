import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { staffSession } from "../../../../lib/staff-access";
import { parseHomeSlide } from "../../../../lib/home-slides";

export const dynamic = "force-dynamic";
const denied = () => NextResponse.json({ message: "전체 관리자만 이용할 수 있습니다." }, { status: 403 });
const allowed = (request: NextRequest) => staffSession(request) === "전체 관리자";

export async function GET(request: NextRequest) {
  if (!allowed(request)) return denied();
  try {
    const result = await getServerSupabase().from("student_home_slides").select("*").order("display_order").order("id");
    if (result.error) throw result.error;
    return NextResponse.json({ slides: result.data || [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[home-slides] list failed", error);
    return NextResponse.json({ message: "배너를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!allowed(request)) return denied();
  try {
    const draft = parseHomeSlide((await request.json()).draft);
    const db = getServerSupabase();
    const last = await db.from("student_home_slides").select("display_order").order("display_order", { ascending: false }).limit(1);
    if (last.error) throw last.error;
    const displayOrder = Math.max(0, Number(last.data?.[0]?.display_order || 0)) + 10;
    const created = await db.from("student_home_slides").insert({ draft, published: null, display_order: displayOrder, is_active: false }).select("*").single();
    if (created.error) throw created.error;
    return NextResponse.json({ slide: created.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "초안을 저장하지 못했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!allowed(request)) return denied();
  try {
    const input = await request.json();
    const id = Number(input.id);
    const action = String(input.action || "");
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ message: "배너를 선택해주세요." }, { status: 400 });
    const db = getServerSupabase();
    const current = await db.from("student_home_slides").select("*").eq("id", id).single();
    if (current.error) throw current.error;
    if (action === "move") {
      const ordered = await db.from("student_home_slides").select("id,display_order").order("display_order").order("id");
      if (ordered.error) throw ordered.error;
      const index = (ordered.data || []).findIndex((row) => row.id === id);
      const next = index + (input.direction === "up" ? -1 : 1);
      if (index < 0 || next < 0 || next >= (ordered.data || []).length) return NextResponse.json({ message: "더 이동할 수 없습니다." }, { status: 400 });
      const other = ordered.data![next];
      const first = await db.from("student_home_slides").update({ display_order: other.display_order, updated_at: new Date().toISOString() }).eq("id", id);
      if (first.error) throw first.error;
      const second = await db.from("student_home_slides").update({ display_order: current.data.display_order, updated_at: new Date().toISOString() }).eq("id", other.id);
      if (second.error) throw second.error;
      return NextResponse.json({ ok: true });
    }
    const now = new Date().toISOString();
    let payload: Record<string, unknown>;
    if (action === "save") payload = { draft: parseHomeSlide(input.draft), updated_at: now };
    else if (action === "publish") payload = { published: parseHomeSlide(input.draft || current.data.draft), draft: parseHomeSlide(input.draft || current.data.draft), is_active: true, updated_at: now };
    else if (action === "hide") payload = { is_active: false, updated_at: now };
    else if (action === "discard") payload = { draft: current.data.published || current.data.draft, updated_at: now };
    else return NextResponse.json({ message: "지원하지 않는 작업입니다." }, { status: 400 });
    const updated = await db.from("student_home_slides").update(payload).eq("id", id).select("*").single();
    if (updated.error) throw updated.error;
    return NextResponse.json({ slide: updated.data });
  } catch (error) {
    console.error("[home-slides] update failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "배너를 변경하지 못했습니다." }, { status: 400 });
  }
}
