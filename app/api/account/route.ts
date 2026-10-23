import { NextRequest, NextResponse } from "next/server";
import { setSession } from "../../../lib/session";
import { getActiveSession } from "../../../lib/active-session";
import { failure, memberContext, profileInput, sameOrigin } from "../../../lib/member-auth";
import { getServerSupabase } from "../../../lib/supabase-server";

export async function GET(request:NextRequest) {
  try {
    const session=await getActiveSession(request);
    if(!session) return failure("로그인이 필요합니다.",401);
    const auth=await memberContext(request);
    const key=auth?.user.id||session.name,role=auth?"member":session.role;
    const db=getServerSupabase();
    const identity=await db.from("sg_identities").select("provider").eq("target_role",role).eq("target_key",key);
    if(identity.error) throw identity.error;
    const pending=auth?await db.from("sg_academy_requests").select("id,student_name,teacher_name,school,grade,requested_class,requested_books,status,created_at").eq("user_id",auth.user.id).maybeSingle():null;
    if(pending?.error) throw pending.error;
    return NextResponse.json({profile:auth?.user||null,providers:identity.data.map(i=>i.provider),request:pending?.data||null},{headers:{"Cache-Control":"no-store"}});
  } catch { return failure("계정 설정을 불러오지 못했습니다. 계정 저장소 설정을 확인해주세요."); }
}
export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  try {
    const auth=await memberContext(request);
    if(!auth) return failure("개인 계정 로그인이 필요합니다.",401);
    const body=await request.json();
    if(body.action==="academy-enter") {
      if(!auth.user.academy_username) return failure("승인된 학원 연결이 없습니다.",403);
      const user=await auth.db.from("users").select("username,withdrawn_at").eq("username",auth.user.academy_username).maybeSingle();
      if(user.error||!user.data) return failure("학원 계정을 확인하지 못했습니다.",403);
      if(user.data.withdrawn_at) return failure("탈퇴한 학원 계정입니다.",403);
      const active=await auth.db.from("student_roster").select("id").eq("student_name",user.data.username).neq("enrollment_status","퇴원").limit(1);
      if(active.error||!active.data?.length) return failure("현재 재원 중인 반을 확인하지 못했습니다.",403);
      const response=NextResponse.json({ok:true});setSession(response,"student",user.data.username);return response;
    }
    const profile=profileInput(body);
    if(!profile) return failure("학습 유형·이름·학년과 필수 동의 항목을 확인해주세요. 현재 신규 가입은 만 14세 이상만 지원합니다.",400);
    const result=await auth.db.from("university_users").update(profile).eq("id",auth.user.id);
    if(result.error) throw result.error;
    return NextResponse.json({ok:true});
  } catch { return failure(); }
}
