import { NextRequest, NextResponse } from "next/server";
import { getActiveSession } from "../../../../lib/active-session";
import { rateLimit, sameOrigin } from "../../../../lib/member-auth";

export const dynamic = "force-dynamic";

const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
const apiKey = () => process.env.Gemini_ai_key || process.env.GEMINI_API_KEY;

export async function GET() {
  return NextResponse.json({ enabled: Boolean(apiKey()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply("요청 출처를 확인할 수 없습니다.", 403);
  const key = apiKey();
  if (!key) return reply("결결이 AI 연결을 준비 중입니다.", 503);

  try {
    const session = await getActiveSession(request);
    if (!session || !["student", "member", "university"].includes(session.role)) return reply("로그인 후 이용해주세요.", 401);
    if (!await rateLimit(request, "gyeolgyeoli-ai", 6, session.name)) return reply("질문이 많습니다. 잠시 후 다시 시도해주세요.", 429);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return reply("질문을 입력해주세요.", 400);
    const input = body as { question?: unknown; history?: unknown };
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (question.length < 2 || question.length > 800) return reply("질문은 2~800자로 입력해주세요.", 400);
    const history = Array.isArray(input.history) ? input.history.slice(-6) : [];
    if (history.some((turn) => !turn || typeof turn !== "object" || !["user", "assistant"].includes(turn.role) || typeof turn.text !== "string" || turn.text.length > 800)) return reply("대화 내용을 확인해주세요.", 400);
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    if (!/^gemini-[a-z0-9.-]+$/.test(model)) return reply("AI 모델 설정을 확인해주세요.", 503);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "너는 스터디결의 한국어 학습 도우미 결결이다. 학생의 공부 계획, 개념, 오답 복습을 명료하고 친절하게 돕는다. 답을 모르면 불확실하다고 말하고 수식과 문제 조건을 정확히 다룬다. 시험 정답이나 출처를 지어내지 않는다. 개인정보를 요청하지 않는다. 위기나 안전 관련 고민은 보호자·선생님·전문가와 직접 상의하도록 안내한다. 답변은 간결하게, 필요하면 단계별로 설명한다." }] },
        contents: [...history.map((turn) => ({ role: turn.role === "assistant" ? "model" : "user", parts: [{ text: turn.text }] })), { role: "user", parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      console.error("[gyeolgyeoli] Gemini status", response.status);
      return reply(response.status === 429 ? "AI 요청이 몰리고 있습니다. 잠시 후 다시 시도해주세요." : "AI 답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.", 502);
    }
    const result = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim().slice(0, 4000);
    if (!answer) return reply("답변이 비어 있습니다. 질문을 바꿔 다시 시도해주세요.", 502);
    return NextResponse.json({ answer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[gyeolgyeoli] request failed", error instanceof Error ? error.name : "unknown");
    return reply("AI 답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.", 502);
  }
}
