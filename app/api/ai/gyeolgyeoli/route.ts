import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/active-session";
import { rateLimit, sameOrigin } from "../../../../lib/member-auth";
import type { Session } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
const apiKey = () => process.env.Gemini_ai_key || process.env.GEMINI_API_KEY;
const TOPIC_FALLBACK = "이해하지 못했어요.";
const UNCLEAR_FALLBACK = "잘 이해하지 못하는 표현이에요.";
const restrictedTopic = /일베|일간베스트|혐오|여혐|남혐|비하|멸칭|차별|인종주의|이태원\s*(참사|사고)?|세월호|정치|정치인|대통령|국회의원|정당|대선|총선|탄핵|이재명|윤석열|노무현|문재인|박근혜|김대중|이명박|박정희|전두환|노태우|김영삼|한동훈|홍준표|안철수|이준석|조국|국민의힘|민주당/i;
const unclearExpression = (question: string) => question.length <= 12 && !/\s|[?？.!。]/.test(question) && !/^(안녕|안녕하세요|반가워요|고마워|고마워요|감사합니다)$/.test(question);
type Owner = { column: "student_username" | "member_id"; value: string };

async function ownerOf(session: Session): Promise<Owner | null> {
  if (session.role === "student") return { column: "student_username", value: session.name };
  if (session.role === "member") return { column: "member_id", value: session.name };
  if (session.role !== "university") return null;
  const result = await getServerSupabase().from("university_users").select("id").eq("email", session.name).maybeSingle();
  if (result.error) throw result.error;
  return result.data ? { column: "member_id", value: result.data.id } : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getActiveSession(request);
    const owner = session && await ownerOf(session);
    if (!owner) return reply("로그인 후 이용해주세요.", 401);
    const before = request.nextUrl.searchParams.get("before");
    if (before && (before.length > 40 || Number.isNaN(Date.parse(before)))) return reply("대화 기록 위치가 올바르지 않습니다.", 400);
    const db = getServerSupabase();
    let query = db.from("gyeolgyeoli_messages").select("id,question,answer,created_at").eq(owner.column, owner.value).order("created_at", { ascending: false }).limit(26);
    if (before) query = query.lt("created_at", before);
    const records = await query;
    if (records.error) throw records.error;
    const page = (records.data || []).slice(0, 25);
    return NextResponse.json({ enabled: Boolean(apiKey()), messages: page.reverse(), nextCursor: (records.data || []).length > 25 ? page[0]?.created_at : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[gyeolgyeoli] history failed", error instanceof Error ? error.name : "unknown");
    return reply("대화 기록을 불러오지 못했습니다.", 502);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return reply("요청 출처를 확인할 수 없습니다.", 403);
  try {
    const session = await getActiveSession(request);
    const owner = session && await ownerOf(session);
    if (!owner) return reply("로그인 후 이용해주세요.", 401);
    const removed = await getServerSupabase().from("gyeolgyeoli_messages").delete().eq(owner.column, owner.value);
    if (removed.error) throw removed.error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[gyeolgyeoli] clear failed", error instanceof Error ? error.name : "unknown");
    return reply("대화 기록을 삭제하지 못했습니다.", 502);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply("요청 출처를 확인할 수 없습니다.", 403);
  const key = apiKey();
  if (!key) return reply("결결이 AI 연결을 준비 중입니다.", 503);

  try {
    const session = await getActiveSession(request);
    const owner = session && await ownerOf(session);
    if (!owner) return reply("로그인 후 이용해주세요.", 401);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return reply("질문을 입력해주세요.", 400);
    const input = body as { question?: unknown };
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (question.length < 2 || question.length > 800) return reply("질문은 2~800자로 입력해주세요.", 400);
    if (!await rateLimit(request, "gyeolgyeoli-ai-v2", 20, `${session.role}:${session.name}`)) return reply("10분에 질문 20개까지 이용할 수 있습니다. 잠시 후 다시 질문해주세요.", 429);
    const db = getServerSupabase();
    const fallback = restrictedTopic.test(question) ? TOPIC_FALLBACK : unclearExpression(question) ? UNCLEAR_FALLBACK : null;
    if (fallback) {
      const saved = await db.from("gyeolgyeoli_messages").insert({ [owner.column]: owner.value, question, answer: fallback }).select("id,created_at").single();
      if (saved.error) console.error("[gyeolgyeoli] fallback save failed", saved.error.code);
      return NextResponse.json({ answer: fallback, saved: !saved.error, id: saved.data?.id, createdAt: saved.data?.created_at }, { headers: { "Cache-Control": "no-store" } });
    }
    const recent = await db.from("gyeolgyeoli_messages").select("question,answer").eq(owner.column, owner.value).order("created_at", { ascending: false }).limit(3);
    if (recent.error) throw recent.error;
    const history = (recent.data || []).filter((item) => item.answer !== TOPIC_FALLBACK && item.answer !== UNCLEAR_FALLBACK).reverse().flatMap((item) => [
      { role: "user", parts: [{ text: item.question }] },
      { role: "model", parts: [{ text: item.answer.slice(0, 800) }] },
    ]);
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    if (!/^gemini-[a-z0-9.-]+$/.test(model)) return reply("AI 모델 설정을 확인해주세요.", 503);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "너는 스터디결의 한국어 학습 도우미 결결이다. 학생의 공부 계획, 개념, 오답 복습을 명료하고 친절하게 돕는다. 정치·정치인, 혐오·비하 표현, 이태원 참사·세월호 관련 내용이면 다른 설명이나 권유 없이 정확히 '이해하지 못했어요.'라고만 답한다. 단어·이름만 던진 모호한 입력이면 정확히 '잘 이해하지 못하는 표현이에요.'라고만 답한다. 그 외 학습 질문에서 답을 모르면 불확실하다고 말하고 수식과 문제 조건을 정확히 다룬다. 시험 정답이나 출처를 지어내지 않는다. 개인정보를 요청하지 않는다. 위기나 안전 관련 고민은 보호자·선생님·전문가와 직접 상의하도록 안내한다. 답변은 간결하게, 필요하면 단계별로 설명한다." }] },
        contents: [...history, { role: "user", parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 700 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: { status?: string; details?: { reason?: string }[] } } | null;
      const reason = failure?.error?.details?.find((item) => item.reason)?.reason || failure?.error?.status || "unknown";
      console.error("[gyeolgyeoli] Gemini status", response.status, reason);
      if (reason === "API_KEY_INVALID") return reply("Gemini API 키가 유효하지 않습니다. 관리자에게 알려주세요.", 503);
      return reply(response.status === 429 ? "AI 요청이 몰리고 있습니다. 잠시 후 다시 시도해주세요." : "AI 답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.", 502);
    }
    const result = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const rawAnswer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim().slice(0, 4000);
    const answer = rawAnswer && restrictedTopic.test(rawAnswer) ? TOPIC_FALLBACK : rawAnswer;
    if (!answer) return reply("답변이 비어 있습니다. 질문을 바꿔 다시 시도해주세요.", 502);
    const saved = await db.from("gyeolgyeoli_messages").insert({ [owner.column]: owner.value, question, answer }).select("id,created_at").single();
    if (saved.error) {
      console.error("[gyeolgyeoli] save failed", saved.error.code);
      return NextResponse.json({ answer, saved: false }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ answer, saved: true, id: saved.data.id, createdAt: saved.data.created_at }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[gyeolgyeoli] request failed", error instanceof Error ? error.name : "unknown");
    return reply("AI 답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.", 502);
  }
}

