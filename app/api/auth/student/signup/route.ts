import { NextRequest, NextResponse } from "next/server";
import { equalSecret, failure, rateLimit, sameOrigin } from "../../../../../lib/member-auth";
import { getSession } from "../../../../../lib/session";
import { getServerSupabase } from "../../../../../lib/supabase-server";
import { hashPassword, passwordMatches } from "../../../../../lib/student-auth";

const GRADES = new Set(["중3", "고1", "고2", "고3"]);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure("잘못된 요청입니다.", 403);
  if (getSession(request)) return failure("새 학생 계정을 만들려면 먼저 로그아웃해주세요.", 409);
  try {
    if (!await rateLimit(request, "student-signup", 8)) return failure("가입 시도가 많습니다. 잠시 후 다시 시도해주세요.", 429);
    const { username, loginId, password, grade, signupCode, email, phone, age14, acceptTerms, acceptPrivacy } = await request.json();
    const name = String(username || "").trim();
    const chosenLoginId = String(loginId || "").trim().toLowerCase();
    const pw = String(password || "");
    const contactEmail = String(email || "").trim().toLowerCase();
    const rawPhone = String(phone || "").trim();
    const contactPhone = rawPhone.replace(/\D/g, "");
    const code = process.env.STUDENT_SIGNUP_CODE;
    if (!code) return failure("학생 가입코드 설정을 확인해주세요.");
    if (!equalSecret(String(signupCode || ""), code)) return failure("학원 가입코드가 올바르지 않습니다.", 403);
    if (!name || name.length > 60 || pw.length < 8 || pw.length > 128 || !GRADES.has(String(grade)))
      return failure("이름·학년·비밀번호(8자 이상)를 확인해주세요.", 400);
    if (!/^[a-z][a-z0-9_]{3,19}$/.test(chosenLoginId))
      return failure("아이디는 영문자로 시작하고 영문 소문자·숫자·밑줄 4~20자로 입력해주세요.", 400);
    if (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || !/^[0-9 -]{10,20}$/.test(rawPhone) || !/^0\d{9,10}$/.test(contactPhone))
      return failure("이메일과 휴대전화 번호를 정확히 입력해주세요.", 400);
    if (age14 !== true || acceptTerms !== true || acceptPrivacy !== true)
      return failure("연령 확인과 약관·개인정보 처리 동의가 필요합니다.", 400);
    const acceptedAt = new Date().toISOString();

    const db = getServerSupabase();
    const existing = await db.from("users").select("username,password_hash,signup_status,login_id").eq("username", name).maybeSingle();
    if (existing.error) throw existing.error;
    const sameLoginId = await db.from("users").select("username").eq("login_id", chosenLoginId).maybeSingle();
    if (sameLoginId.error) throw sameLoginId.error;
    if (sameLoginId.data && sameLoginId.data.username !== name) return failure("이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.", 409);
    if (existing.data?.signup_status === "pending") return failure("가입 신청이 접수돼 있습니다. 관리자 승인을 기다려주세요.", 409);
    if (existing.data?.signup_status === "rejected") {
      if (!passwordMatches(pw, existing.data.password_hash)) return failure("기존 신청의 비밀번호가 일치하지 않습니다. 관리자에게 문의해주세요.", 403);
      const retried = await db.from("users").update({ grade, login_id: chosenLoginId, email: contactEmail, phone: contactPhone, signup_status: "pending", signup_reviewed_at: null, signup_reviewer: null, terms_accepted_at: acceptedAt, privacy_accepted_at: acceptedAt }).eq("username", name).eq("signup_status", "rejected").select("username");
      if (retried.error?.code === "23505") return failure("이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.", 409);
      if (retried.error) throw retried.error;
      if (!retried.data?.length) return failure("신청 상태가 변경됐습니다. 다시 확인해주세요.", 409);
      return NextResponse.json({ ok: true, message: "가입을 다시 신청했습니다. 관리자 승인을 기다려주세요." }, { status: 202, headers: { "Cache-Control": "no-store" } });
    }
    if (existing.data) return failure("이미 가입된 이름입니다. 기존 계정으로 로그인하거나 비밀번호 재설정을 요청해주세요.", 409);
    const clean = name.replace(/\s+/g, "");
    const userNames = new Set<string>();
    const rosterNames = new Set<string>();
    for (let start = 0; ; start += 1000) {
      const [users, roster] = await Promise.all([
        db.from("users").select("username").range(start, start + 999),
        db.from("student_roster").select("student_name").range(start, start + 999),
      ]);
      if (users.error || roster.error) throw users.error || roster.error;
      for (const row of users.data || []) userNames.add(String(row.username || "").replace(/\s+/g, ""));
      for (const row of roster.data || []) rosterNames.add(String(row.student_name || "").replace(/\s+/g, ""));
      if ((users.data || []).length < 1000 && (roster.data || []).length < 1000) break;
    }
    if ([...userNames].some(candidate => candidate.toLowerCase() === chosenLoginId)) return failure("기존 계정 이름과 같은 아이디입니다. 다른 아이디를 입력해주세요.", 409);
    if (userNames.has(clean)) return failure("이미 가입된 이름입니다. 기존 계정으로 로그인하거나 비밀번호 재설정을 요청해주세요.", 409);
    if (!rosterNames.has(clean) && [...userNames, ...rosterNames].some(candidate => candidate.length >= 2 && (candidate.includes(clean) || clean.includes(candidate))))
      return failure("기존 학생 이름과 비슷합니다. 담당 선생님에게 계정을 확인해주세요.", 409);
    const inserted = await db.from("users").insert({ username: name, login_id: chosenLoginId, password_hash: hashPassword(pw), grade, email: contactEmail, phone: contactPhone, temp_password: "", signup_status: "pending", terms_accepted_at: acceptedAt, privacy_accepted_at: acceptedAt, created_at: acceptedAt }).select("username").single();
    if (inserted.error?.code === "23505") return failure("이미 사용 중인 학생 이름 또는 아이디입니다. 다시 확인해주세요.", 409);
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ ok: true, message: "가입 신청을 접수했습니다. 관리자 승인 후 로그인할 수 있습니다." }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[student signup] failed", error);
    return failure("가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}
