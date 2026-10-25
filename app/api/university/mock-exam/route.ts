import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { memberContext, sameOrigin } from "../../../../lib/member-auth";
import { MOCK_DURATION_MINUTES, MOCK_SLUG, MOCK_TITLE, mockQuestions, parseMockAnswers } from "../../../../lib/university-mock-questions";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: noStore });

function configuration() {
  const opensAt = Date.parse(process.env.UNIVERSITY_MOCK_OPEN_AT || "");
  const closesAt = Date.parse(process.env.UNIVERSITY_MOCK_CLOSE_AT || "");
  const key = (process.env.UNIVERSITY_MOCK_ANSWER_KEY || "").split(",").map((item) => Number(item.trim()));
  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt) || closesAt <= opensAt || key.length !== mockQuestions.length || key.some((choice, index) => !Number.isInteger(choice) || choice < 0 || choice >= mockQuestions[index].choices.length)) return null;
  return { opensAt, closesAt, key };
}

function scoreOf(answers: Record<string, number>, key: number[]) {
  const correct = mockQuestions.reduce((count, question, index) => count + (answers[question.id] === key[index] ? 1 : 0), 0);
  return Math.round((correct / mockQuestions.length) * 100);
}

async function authenticated(request: NextRequest) {
  const auth = await memberContext(request);
  return auth?.user.onboarding_complete && !auth.user.withdrawn_at && auth.user.learner_type === "university" ? auth : null;
}

async function readAttempt(db: ReturnType<typeof import("../../../../lib/supabase-server").getServerSupabase>, userId: string) {
  const result = await db.from("university_mock_attempts").select("id,alias,started_at,deadline_at,submitted_at,answers,score").eq("exam_slug", MOCK_SLUG).eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

async function finalizeExpired(db: ReturnType<typeof import("../../../../lib/supabase-server").getServerSupabase>, attempt: NonNullable<Awaited<ReturnType<typeof readAttempt>>>, key: number[]) {
  if (attempt.submitted_at || Date.now() < Date.parse(attempt.deadline_at)) return attempt;
  const answers = parseMockAnswers(attempt.answers) || {};
  const result = await db.from("university_mock_attempts").update({ submitted_at: new Date().toISOString(), score: scoreOf(answers, key) }).eq("id", attempt.id).is("submitted_at", null).select("id,alias,started_at,deadline_at,submitted_at,answers,score").maybeSingle();
  if (result.error) throw result.error;
  return result.data || attempt;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticated(request);
    if (!auth) return reply({ message: "대학생 계정으로 로그인해주세요." }, 401);
    const config = configuration();
    if (!config) return reply({ ready: false, title: MOCK_TITLE, message: "첫 공식 모의고사를 준비 중입니다." });
    const now = Date.now();
    let attempt = await readAttempt(auth.db, auth.user.id);
    if (attempt) attempt = await finalizeExpired(auth.db, attempt, config.key);
    const closed = now >= config.closesAt;
    const state = now < config.opensAt ? "upcoming" : closed ? "closed" : "open";
    const result: Record<string, unknown> = {
      ready: true, title: MOCK_TITLE, state,
      opensAt: new Date(config.opensAt).toISOString(), closesAt: new Date(config.closesAt).toISOString(),
      durationMinutes: MOCK_DURATION_MINUTES, questionCount: mockQuestions.length,
      attempt: attempt ? { startedAt: attempt.started_at, deadlineAt: attempt.deadline_at, submittedAt: attempt.submitted_at, alias: attempt.alias, answers: attempt.submitted_at ? undefined : attempt.answers } : null,
    };
    if (attempt && !attempt.submitted_at && !closed) result.questions = mockQuestions;
    if (closed && attempt?.submitted_at) {
      const [ranked, total, higher, earlier] = await Promise.all([
        auth.db.from("university_mock_attempts").select("user_id,alias,score").eq("exam_slug", MOCK_SLUG).not("submitted_at", "is", null).order("score", { ascending: false }).order("submitted_at", { ascending: true }).limit(20),
        auth.db.from("university_mock_attempts").select("id", { count: "exact", head: true }).eq("exam_slug", MOCK_SLUG).not("submitted_at", "is", null),
        auth.db.from("university_mock_attempts").select("id", { count: "exact", head: true }).eq("exam_slug", MOCK_SLUG).gt("score", attempt.score),
        auth.db.from("university_mock_attempts").select("id", { count: "exact", head: true }).eq("exam_slug", MOCK_SLUG).eq("score", attempt.score).lt("submitted_at", attempt.submitted_at),
      ]);
      if (ranked.error || total.error || higher.error || earlier.error) throw ranked.error || total.error || higher.error || earlier.error;
      const rows = ranked.data || [];
      result.myScore = attempt.score;
      result.myRank = (higher.count || 0) + (earlier.count || 0) + 1;
      result.participantCount = total.count || 0;
      result.ranking = rows.slice(0, 20).map((row, index) => ({ rank: index + 1, alias: row.alias, score: row.score, mine: row.user_id === auth.user.id }));
    }
    return reply(result);
  } catch (error) {
    console.error("[university mock GET]", error);
    return reply({ message: "모의고사 정보를 불러오지 못했습니다." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return reply({ message: "요청 출처를 확인할 수 없습니다." }, 403);
    const auth = await authenticated(request);
    if (!auth) return reply({ message: "대학생 계정으로 로그인해주세요." }, 401);
    const config = configuration();
    if (!config) return reply({ message: "모의고사가 아직 준비되지 않았습니다." }, 503);
    const now = Date.now();
    if (now < config.opensAt || now >= config.closesAt) return reply({ message: "현재 응시 가능한 기간이 아닙니다." }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    let attempt = await readAttempt(auth.db, auth.user.id);
    if (action === "start") {
      if (!attempt) {
        const startedAt = new Date(now).toISOString();
        const deadlineAt = new Date(Math.min(now + MOCK_DURATION_MINUTES * 60000, config.closesAt)).toISOString();
        const insert = await auth.db.from("university_mock_attempts").insert({ exam_slug: MOCK_SLUG, user_id: auth.user.id, alias: `참가자-${randomBytes(3).toString("hex").toUpperCase()}`, started_at: startedAt, deadline_at: deadlineAt }).select("id").maybeSingle();
        if (insert.error && insert.error.code !== "23505") throw insert.error;
        attempt = await readAttempt(auth.db, auth.user.id);
      }
      return reply({ ok: true, started: Boolean(attempt) });
    }
    if (!attempt) return reply({ message: "먼저 응시를 시작해주세요." }, 400);
    if (attempt.submitted_at) return reply({ message: "이미 제출한 모의고사입니다." }, 409);
    if (now >= Date.parse(attempt.deadline_at)) {
      await finalizeExpired(auth.db, attempt, config.key);
      return reply({ message: "제한 시간이 종료되어 저장된 답안으로 제출됐습니다." }, 409);
    }
    const answers = parseMockAnswers(body.answers);
    if (!answers) return reply({ message: "답안 형식을 확인해주세요." }, 400);
    if (action === "save") {
      const saved = await auth.db.from("university_mock_attempts").update({ answers }).eq("id", attempt.id).is("submitted_at", null).gt("deadline_at", new Date().toISOString()).select("id").maybeSingle();
      if (saved.error) throw saved.error;
      return saved.data ? reply({ ok: true }) : reply({ message: "제한 시간이 종료됐습니다." }, 409);
    }
    if (action === "submit") {
      const submitted = await auth.db.from("university_mock_attempts").update({ answers, score: scoreOf(answers, config.key), submitted_at: new Date().toISOString() }).eq("id", attempt.id).is("submitted_at", null).gt("deadline_at", new Date().toISOString()).select("id").maybeSingle();
      if (submitted.error) throw submitted.error;
      return submitted.data ? reply({ ok: true }) : reply({ message: "이미 제출됐거나 제한 시간이 종료됐습니다." }, 409);
    }
    return reply({ message: "지원하지 않는 요청입니다." }, 400);
  } catch (error) {
    console.error("[university mock POST]", error);
    return reply({ message: "모의고사 요청을 처리하지 못했습니다." }, 500);
  }
}
