import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../../../lib/session";
import { getActiveSession } from "../../../../../lib/active-session";
import { getServerSupabase } from "../../../../../lib/supabase-server";
import { digest, failure, memberContext, rateLimit, sameOrigin } from "../../../../../lib/member-auth";
import { passwordMatches } from "../../../../../lib/student-auth";
import { matchesUniversityPassword } from "../../../../../lib/university-auth";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  try {
    const clientId=process.env.KAKAO_CLIENT_ID, secret=process.env.KAKAO_CLIENT_SECRET;
    if(!clientId||!secret) return failure("카카오 로그인 설정을 준비 중입니다.");
    const callback=process.env.KAKAO_REDIRECT_URI||"https://studygyeol.vercel.app/api/auth/kakao/callback";
    if(new URL(callback).origin!==request.nextUrl.origin) return failure("카카오 로그인은 https://studygyeol.vercel.app 에서 진행해주세요. 계정 연결은 해당 주소에서 기존 계정으로 먼저 로그인하세요.",409);
    if(!await rateLimit(request,"kakao-start")) return failure("잠시 후 다시 시도해주세요.",429);
    const body=await request.json();
    if(body?.intent!=="link"&&body?.intent!=="login") return failure("카카오 로그인 요청을 확인해주세요.",400);
    const session=await getActiveSession(request), db=getServerSupabase();
    let targetRole:string|null=null,targetKey:string|null=null;
    if(body.intent==="link") {
      if(!session||session.role==="teacher") return failure("연결할 학생 또는 개인 계정으로 먼저 로그인해주세요.",401);
      const password=String(body.password||"");
      if(password.length>128) return failure("비밀번호를 확인해주세요.",400);
      if(session.role==="student") {
        const result=await db.from("users").select("password_hash,temp_password").eq("username",session.name).maybeSingle();
        if(result.error) throw result.error;
        if(!result.data||result.data.temp_password||!passwordMatches(password,result.data.password_hash)) return failure("현재 비밀번호를 확인해주세요. 임시 비밀번호는 먼저 변경해주세요.",403);
        targetRole="student";targetKey=session.name;
      } else {
        const auth=await memberContext(request);
        if(!auth) return failure("로그인이 필요합니다.",401);
        if(!auth.user.academy_username) return failure("학원 연결 승인 후 카카오 계정을 연결할 수 있습니다.",403);
        const result=await db.from("university_users").select("password_hash").eq("id",auth.user.id).single();
        if(result.error) throw result.error;
        if(result.data.password_hash) {
          if(!matchesUniversityPassword(password,result.data.password_hash)) return failure("현재 비밀번호를 확인해주세요.",403);
        } else {
          const emailIdentity=await db.from("sg_identities").select("provider").eq("target_role","member").eq("target_key",auth.user.id).eq("provider","email").maybeSingle();
          if(emailIdentity.error) throw emailIdentity.error;
          if(!emailIdentity.data||!session.issuedAt||Date.now()/1000-session.issuedAt>300) return failure("이메일 인증으로 다시 로그인한 뒤 5분 안에 카카오 연결을 진행해주세요.",403);
        }
        targetRole="member";targetKey=auth.user.id;
      }
    } else if(session) return failure("새 계정 로그인을 하려면 먼저 로그아웃해주세요. 기존 기록을 유지하려면 계정 관리에서 연결하세요.",409);
    const state=randomBytes(32).toString("base64url"), browser=randomBytes(32).toString("base64url");
    const inserted=await db.from("sg_oauth_attempts").insert({state_hash:digest(state),browser_hash:digest(browser),session_hash:targetRole?digest(request.cookies.get(SESSION_COOKIE)?.value||""):null,target_role:targetRole,target_key:targetKey,expires_at:new Date(Date.now()+600000).toISOString()});
    if(inserted.error) throw inserted.error;
    const url=new URL("https://kauth.kakao.com/oauth/authorize");
    url.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:"code",state}).toString();
    const response=NextResponse.json({url:url.toString()});
    response.cookies.set("sg_kakao_state",browser,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api/auth/kakao",maxAge:600});
    response.headers.set("Cache-Control","no-store");
    return response;
  } catch { return failure("카카오 연결을 시작하지 못했습니다. 계정 저장소와 로그인 설정을 확인해주세요."); }
}
