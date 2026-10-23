import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "./active-session";
import { getServerSupabase } from "./supabase-server";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function equalSecret(a: string, b: string) {
  const x = Buffer.from(digest(a)), y = Buffer.from(digest(b));
  return timingSafeEqual(x, y);
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === request.nextUrl.origin);
}
export function failure(message = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.", status = 503) {
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function memberContext(request: NextRequest) {
  const session = await getActiveSession(request);
  if (!session || !["member", "university"].includes(session.role)) return null;
  const db = getServerSupabase();
  const query = db.from("university_users").select("id,email,display_name,learner_type,school,grade,major,onboarding_complete,academy_username,phone,withdrawn_at");
  const result = await (session.role === "member" ? query.eq("id", session.name) : query.eq("email", session.name)).maybeSingle();
  if (result.error) throw result.error;
  return result.data ? { db, user: result.data, session } : null;
}
export async function rateLimit(request: NextRequest, category: string, limit = 12, identity = "") {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = Math.floor(Date.now() / 600000);
  const result = await getServerSupabase().rpc("sg_auth_rate_limit", { p_key: digest(`${category}:${address}:${identity}:${bucket}`), p_limit: limit });
  if (result.error) throw result.error;
  return result.data === true;
}
export function profileInput(body: Record<string, unknown>) {
  const name = String(body.name || "").trim();
  const learner = String(body.learnerType || "");
  const school = String(body.school || "").trim();
  const grade = String(body.grade || "").trim();
  const major = learner === "university" ? String(body.major || "").trim() : "";
  if (!name || name.length > 60 || !["school", "university", "general"].includes(learner) || school.length > 120 || grade.length > 30 || major.length > 100) return null;
  if (body.acceptTerms !== true || body.acceptPrivacy !== true || body.age14 !== true) return null;
  if (learner === "school" && !["중1", "중2", "중3", "고1", "고2", "고3", "해당 없음"].includes(grade)) return null;
  if (learner === "university" && !["1학년", "2학년", "3학년", "4학년", "5학년 이상", "대학원", "해당 없음"].includes(grade)) return null;
  return { display_name: name, learner_type: learner, school: learner === "general" ? "" : school, grade: learner === "general" ? "" : grade, major, onboarding_complete: true, consent_version: "2026-10-18", consent_at: new Date().toISOString() };
}
