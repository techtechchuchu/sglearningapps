import { NextRequest, NextResponse } from "next/server";
import { digest } from "../../../../../lib/member-auth";
import { getServerSupabase } from "../../../../../lib/supabase-server";
import { getSession, SESSION_COOKIE, setSession } from "../../../../../lib/session";

export async function GET(request:NextRequest) {
  const callback=process.env.KAKAO_REDIRECT_URI||"https://studygyeol.vercel.app/api/auth/kakao/callback";
  const finish=(message?:string)=>{
    const url=new URL("/",new URL(callback).origin);
    if(message) url.searchParams.set("auth_message",message);
    const response=NextResponse.redirect(url);
    response.cookies.set("sg_kakao_state","",{path:"/api/auth/kakao",maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax"});
    response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");return response;
  };
  try {
    const state=request.nextUrl.searchParams.get("state"), browser=request.cookies.get("sg_kakao_state")?.value;
    if(!state||state.length>200||!browser) return finish("인증 시간이 만료됐습니다. 다시 시작해주세요.");
    const db=getServerSupabase();
    // DELETE ... RETURNING atomically consumes the attempt; replayed callbacks fail closed.
    const consumed=await db.from("sg_oauth_attempts").delete().eq("state_hash",digest(state)).eq("browser_hash",digest(browser)).gt("expires_at",new Date().toISOString()).select("target_role,target_key,session_hash").maybeSingle();
    if(consumed.error||!consumed.data) return finish("인증 요청을 확인하지 못했습니다. 다시 시작해주세요.");
    const attempt=consumed.data;
    if(!attempt.target_role&&getSession(request)) return finish("이미 다른 계정으로 로그인되어 있습니다. 로그아웃 후 다시 시도해주세요.");
    if(attempt.target_role&&attempt.session_hash!==digest(request.cookies.get(SESSION_COOKIE)?.value||"")) return finish("계정이 변경되었습니다. 연결을 다시 시작해주세요.");
    if(request.nextUrl.searchParams.has("error")) return finish("카카오 로그인이 취소되었습니다.");
    const code=request.nextUrl.searchParams.get("code");
    if(!code||code.length>2000||!process.env.KAKAO_CLIENT_ID||!process.env.KAKAO_CLIENT_SECRET) return finish("카카오 인증 설정을 확인해주세요.");
    const tokenResponse=await fetch("https://kauth.kakao.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:process.env.KAKAO_CLIENT_ID,client_secret:process.env.KAKAO_CLIENT_SECRET,redirect_uri:callback,code}),cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!tokenResponse.ok) return finish("카카오 인증을 완료하지 못했습니다. 다시 시도해주세요.");
    const token=await tokenResponse.json();
    if(typeof token.access_token!=="string") return finish("카카오 인증 응답을 확인하지 못했습니다.");
    const meResponse=await fetch("https://kapi.kakao.com/v2/user/me",{headers:{Authorization:`Bearer ${token.access_token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!meResponse.ok) return finish("카카오 계정 정보를 확인하지 못했습니다.");
    const me=await meResponse.json();
    if(!Number.isSafeInteger(me.id)||me.id<=0) return finish("카카오 계정 식별 정보를 확인하지 못했습니다.");
    // Provider tokens and profile images are not retained. Email is not used to merge accounts.
    const account=me.kakao_account;
    const email=account?.is_email_valid===true&&account?.is_email_verified===true&&typeof account.email==="string"?account.email.toLowerCase():null;
    const resolved=await db.rpc("sg_resolve_identity",{p_provider:"kakao",p_subject:String(me.id),p_email:email,p_role:attempt.target_role,p_key:attempt.target_key});
    if(resolved.error) {
      const msg=resolved.error.message;
      return finish(msg.includes("existing_email")?"이미 가입된 이메일입니다. 기존 계정으로 로그인한 뒤 카카오를 연결해주세요.":msg.includes("identity_already")||resolved.error.code==="23505"?"이미 다른 계정에 연결된 카카오 계정입니다.":"계정 연결을 완료하지 못했습니다.");
    }
    const identity=resolved.data;
    if(!identity||!["student","member"].includes(identity.role)) return finish("계정 정보를 확인하지 못했습니다.");
    const exists=identity.role==="student"?await db.from("users").select("username,withdrawn_at").eq("username",identity.key).maybeSingle():await db.from("university_users").select("id,withdrawn_at").eq("id",identity.key).maybeSingle();
    if(exists.error||!exists.data) return finish("연결된 계정을 찾지 못했습니다. 관리자에게 문의해주세요.");
    if(exists.data.withdrawn_at) return finish("탈퇴한 계정입니다. 관리자에게 문의해주세요.");
    const response=finish(attempt.target_role?"카카오 연결을 완료했습니다. 기존 로그인도 계속 사용할 수 있습니다.":undefined);
    setSession(response,identity.role,identity.key);return response;
  } catch { return finish("카카오 로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."); }
}
