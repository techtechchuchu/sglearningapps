import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/active-session";
import { rateLimit, sameOrigin } from "../../../../lib/member-auth";
import type { Session } from "../../../../lib/session";
import { getServerSupabase } from "../../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
const apiKey = () => process.env.Gemini_ai_key || process.env.GEMINI_API_KEY;
const TOPIC_FALLBACK = "이해하지 못했어요.";
const STUDY_SUGGESTION_BACKUP: Record<string, string> = {
  "이번 주 공부 계획을 세워줘": "이번 주 해야 할 과목과 과제를 먼저 적어 보세요. 마감이 가까운 것부터 하루에 1~2개씩 배치하고, 매일 끝에 10분 동안 완료한 것과 밀린 것을 확인하면 좋아요.",
  "오답을 복습하는 방법을 알려줘": "틀린 이유를 계산 실수·개념 부족·문제 해석 중 하나로 적고, 해설을 덮은 채 다시 풀어 보세요. 이틀 뒤 같은 문제를 한 번 더 풀어 맞히면 복습이 더 오래 남습니다.",
  "시험 전날에는 무엇을 해야 해?": "새로운 문제를 많이 풀기보다 이미 틀린 문제와 핵심 개념을 짧게 확인하세요. 준비물과 시험 시간을 미리 챙기고, 잠을 충분히 자는 것이 좋습니다.",
};
const UNCLEAR_FALLBACK = "잘 이해하지 못하는 표현이에요.";
const STUDENT_SUPPORT_PROMPT = `너는 스터디결의 한국어 앱 이용 안내 AI 상담사 결결이다. SG고등관 학생에게 스터디결 사용법과 이용 중 불편을 안내한다. 학습 개념 설명, 시험 풀이, 공부 계획 상담은 하지 않고, 해당 질문에는 '이 기능은 앱 이용 안내용입니다. 학습 질문은 선생님께 질문 또는 문제별 해설을 이용해주세요.'라고 짧게 안내한다.
확인된 사용법: 학생 화면에는 홈, 오답 작성, 학교 기출, 마이페이지, 기능 더보기가 있다. 오답 작성에서는 시험 시기·교재·수록 학교·문제번호를 선택하고 변형문제 필요 여부를 선택한 뒤 제출 내용을 확인한다. 변형문제를 요청할 때는 필요한 번호를 적고, 요청 문구를 복사해 담당 선생님의 카카오채널 채팅방에 직접 붙여넣어 전송해야 한다. 앱은 실제 카카오 전송 여부를 확인하지 못한다. 마이페이지에서 기록과 계정 정보를 확인한다. 가입은 가입코드로 신청하고 재원 명단 확인 후 승인을 받아야 로그인할 수 있다. 비밀번호 재설정은 담당 선생님에게 요청한다.
할 수 없는 일: 계정 승인, 비밀번호 변경, 기록 수정, 카카오 메시지 전송, 불편 신고의 정식 접수를 대신 처리할 수 없다. 해결되지 않는 오류나 사람의 확인이 필요한 불편은 화면 하단 '오픈채팅 문의'로 안내한다. 없는 메뉴나 처리 결과를 지어내지 않는다. 비밀번호·인증코드·연락처 같은 개인정보를 요구하지 않는다. 답변은 간결하고 실제 화면의 단계대로 설명한다. 정치·정치인, 혐오·비하 표현, 이태원 참사·세월호 관련 질문에는 다른 설명 없이 정확히 '이해하지 못했어요.'라고만 답한다.`;
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
    const studentSupport = session.role === "student";
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return reply("질문을 입력해주세요.", 400);
    const input = body as { question?: unknown };
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (question.length < 2 || question.length > 800) return reply("질문은 2~800자로 입력해주세요.", 400);
    if (!await rateLimit(request, "gyeolgyeoli-ai-v2", 20, `${session.role}:${session.name}`)) return reply("10분에 질문 20개까지 이용할 수 있습니다. 잠시 후 다시 질문해주세요.", 429);
    const db = getServerSupabase();
    const fallback = restrictedTopic.test(question) ? TOPIC_FALLBACK : !studentSupport && unclearExpression(question) ? UNCLEAR_FALLBACK : null;
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
        systemInstruction: { parts: [{ text: studentSupport ? STUDENT_SUPPORT_PROMPT : "너는 스터디결의 한국어 학습 도우미 결결이다. 학생의 공부 계획, 개념, 오답 복습을 명료하고 친절하게 돕는다. 시험 전날 공부법처럼 일반적인 학습 질문에는 구체적으로 답한다. 학생의 질문이 정치·정치인, 혐오·비하 표현, 이태원 참사·세월호 관련 내용이면 다른 설명이나 권유 없이 정확히 '이해하지 못했어요.'라고만 답한다. 단어·이름만 던진 모호한 입력이면 정확히 '잘 이해하지 못하는 표현이에요.'라고만 답한다. 그 외 학습 질문에서 답을 모르면 불확실하다고 말하고 수식과 문제 조건을 정확히 다룬다. 시험 정답이나 출처를 지어내지 않는다. 개인정보를 요청하지 않는다. 위기나 안전 관련 고민은 보호자·선생님·전문가와 직접 상의하도록 안내한다. 답변은 간결하게, 필요하면 단계별로 설명한다." }] },
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
    const answer = !studentSupport && (rawAnswer === TOPIC_FALLBACK || rawAnswer === UNCLEAR_FALLBACK) ? STUDY_SUGGESTION_BACKUP[question] || rawAnswer : rawAnswer;
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

