import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "../../../../lib/supabase-server";
import { failure, rateLimit, sameOrigin } from "../../../../lib/member-auth";
import { getSession, setSession } from "../../../../lib/session";

export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  if(process.env.AUTH_EMAIL_ENABLED!=="true") return failure("이메일 인증 발송 설정을 준비 중입니다. 기존 이메일 계정 로그인은 계속 이용할 수 있습니다.");
  try {
    if(getSession(request)) return failure("이미 로그인되어 있습니다.",409);
    const body=await request.json(), email=String(body.email||"").trim().toLowerCase();
    if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)) return failure("이메일을 확인해주세요.",400);
    if(!await rateLimit(request,"email",10)||!await rateLimit(request,"email-address",5,email)) return failure("인증 요청이 많습니다. 10분 후 다시 시도해주세요.",429);
    const db=getServerSupabase();
    if(body.action==="send") {
      const result=await db.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
      if(result.error) return failure("인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.");
      return NextResponse.json({ok:true,message:"이메일로 받은 인증번호를 입력해주세요."});
    }
    const code=String(body.code||"");
    if(body.action!=="verify"||!/^\d{6,8}$/.test(code)) return failure("인증번호를 확인해주세요.",400);
    const verified=await db.auth.verifyOtp({email,token:code,type:"email"});
    if(verified.error||!verified.data.user?.email_confirmed_at||verified.data.user.email?.toLowerCase()!==email) return failure("인증번호가 올바르지 않거나 만료됐습니다.",400);
    const resolved=await getServerSupabase().rpc("sg_resolve_identity",{p_provider:"email",p_subject:verified.data.user.id,p_email:email});
    if(resolved.error) return failure(resolved.error.message.includes("existing_email")?"기존 계정이 있습니다. 기존 이메일·비밀번호 로그인으로 접속해주세요.":"계정을 만들지 못했습니다.",409);
    const active=await db.from("university_users").select("withdrawn_at").eq("id",resolved.data.key).maybeSingle();
    if(active.error) throw active.error;
    if(!active.data||active.data.withdrawn_at) return failure("탈퇴한 계정입니다. 관리자에게 문의해주세요.",403);
    const response=NextResponse.json({ok:true});setSession(response,"member",resolved.data.key);return response;
  } catch { return failure(); }
}
