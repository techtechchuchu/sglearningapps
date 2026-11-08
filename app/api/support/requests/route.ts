import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../lib/active-session";
import { rateLimit, sameOrigin } from "../../../lib/member-auth";
import { getServerSupabase } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const fields = "id,requester_role,requester_name,message,status,admin_reply,created_at,replied_at";
const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    if (!session) return fail("로그인 후 이용해주세요.", 401);
    const admin = session.role === "teacher" && session.name === "전체 관리자";
    const all = admin && request.nextUrl.searchParams.get("mine") !== "1";
    const db = getServerSupabase();
    let query = db.from("support_requests").select(fields).order("created_at", { ascending: false }).limit(all ? 100 : 20);
    if (!all) query = query.eq("requester_role", session.role).eq("requester_name", session.name);
    const result = await query;
    if (result.error) throw result.error;
    return NextResponse.json({ requests: result.data || [], admin }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[support-requests] list failed", error instanceof Error ? error.name : "unknown");
    return fail("문의 목록을 불러오지 못했습니다.", 502);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return fail("요청 출처를 확인할 수 없습니다.", 403);
  try {
    const session = await getActiveSession(request);
    if (!session) return fail("로그인 후 이용해주세요.", 401);
    const body: unknown = await request.json();
    const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message.trim() : "";
    if (message.length < 10 || message.length > 2000) return fail("문의 내용은 10~2,000자로 입력해주세요.", 400);
    if (!await rateLimit(request, "support-request", 5, session.role + ":" + session.name)) return fail("문의 접수 횟수가 많습니다. 잠시 후 다시 시도해주세요.", 429);
    const result = await getServerSupabase().from("support_requests").insert({
      requester_role: session.role, requester_name: session.name, message,
    }).select(fields).single();
    if (result.error) throw result.error;
    return NextResponse.json({ request: result.data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[support-requests] create failed", error instanceof Error ? error.name : "unknown");
    return fail("문의를 접수하지 못했습니다. 다시 시도해주세요.", 502);
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return fail("요청 출처를 확인할 수 없습니다.", 403);
  try {
    const session = await getActiveSession(request);
    if (session?.role !== "teacher" || session.name !== "전체 관리자") return fail("전체관리자만 답변할 수 있습니다.", 403);
    const body: unknown = await request.json();
    const input = body && typeof body === "object" ? body as { id?: unknown; reply?: unknown } : {};
    const id = typeof input.id === "string" ? input.id : "";
    const reply = typeof input.reply === "string" ? input.reply.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || reply.length < 2 || reply.length > 2000) return fail("답변 내용을 확인해주세요.", 400);
    const result = await getServerSupabase().from("support_requests").update({ admin_reply: reply, status: "replied", replied_at: new Date().toISOString() }).eq("id", id).select(fields).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return fail("해당 문의를 찾지 못했습니다.", 404);
    return NextResponse.json({ request: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[support-requests] reply failed", error instanceof Error ? error.name : "unknown");
    return fail("답변을 저장하지 못했습니다.", 502);
  }
}
