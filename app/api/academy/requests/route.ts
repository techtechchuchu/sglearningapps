import { NextRequest, NextResponse } from "next/server";
import { equalSecret, failure, memberContext, rateLimit, sameOrigin } from "../../../../lib/member-auth";
import { staffSession } from "../../../../lib/staff-access";
import { getServerSupabase } from "../../../../lib/supabase-server";
const teachers=["이주백.T","박병민.T","노대근.T"];

export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  try {
    const auth=await memberContext(request);
    if(!auth||!auth.user.onboarding_complete) return failure("가입 정보를 먼저 입력해주세요.",401);
    if(auth.user.academy_username) return failure("이미 학원에 연결된 계정입니다.",409);
    if(!await rateLimit(request,"academy",8,auth.user.id)) return failure("잠시 후 다시 신청해주세요.",429);
    const body=await request.json(),code=process.env.ACADEMY_INVITE_CODE;
    if(!code) return failure("학원 초대코드 설정을 준비 중입니다.");
    if(!equalSecret(String(body.code||""),code)) return failure("초대코드를 확인해주세요.",400);
    const name=String(body.studentName||"").trim(), teacher=String(body.teacher||"");
    if(!name||name.length>60||!teachers.includes(teacher)) return failure("학생 이름과 담당 선생님을 확인해주세요.",400);
    // Compare-and-set: only this member's rejected request may return to pending.
    // Concurrent retries cannot overwrite a pending or approved request.
    const retried=await auth.db.from("sg_academy_requests").update({
      student_name:name,teacher_name:teacher,school:auth.user.school,grade:auth.user.grade,
      status:"pending",reviewer:null,reviewed_at:null,created_at:new Date().toISOString(),
    }).eq("user_id",auth.user.id).eq("status","rejected").select("id");
    if(retried.error) throw retried.error;
    if(retried.data?.length) return NextResponse.json({ok:true,message:"학원 연결을 다시 신청했습니다. 담당 선생님의 승인을 기다려주세요."});
    const result=await auth.db.from("sg_academy_requests").insert({user_id:auth.user.id,student_name:name,teacher_name:teacher,school:auth.user.school,grade:auth.user.grade});
    if(result.error?.code==="23505") return failure("이미 신청한 내역이 있습니다. 상태를 확인하거나 학원에 문의해주세요.",409);
    if(result.error) throw result.error;
    return NextResponse.json({ok:true,message:"SG고등관 연결 신청을 접수했습니다. 승인 전에는 학원 자료에 접근할 수 없습니다."});
  } catch { return failure(); }
}
export async function GET(request:NextRequest) {
  try {
    const teacher=staffSession(request);
    if(!teacher||(!teachers.includes(teacher)&&teacher!=="전체 관리자")) return failure("선생님 로그인이 필요합니다.",401);
    const db=getServerSupabase();
    let query=db.from("sg_academy_requests").select("id,student_name,teacher_name,school,grade,status,created_at").eq("status","pending");
    let roster=db.from("student_roster").select("id,student_name,teacher_name,class_name,school_name,grade").neq("enrollment_status","퇴원");
    if(teacher!=="전체 관리자"){query=query.eq("teacher_name",teacher);roster=roster.eq("teacher_name",teacher);}
    const [requests,rows]=await Promise.all([query.order("created_at"),roster.limit(2000)]);
    if(requests.error||rows.error) throw requests.error||rows.error;
    return NextResponse.json({requests:requests.data,roster:rows.data},{headers:{"Cache-Control":"no-store"}});
  } catch { return failure(); }
}
export async function PATCH(request:NextRequest) {
  if(!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  try {
    const teacher=staffSession(request);
    if(!teacher||(!teachers.includes(teacher)&&teacher!=="전체 관리자")) return failure("선생님 로그인이 필요합니다.",401);
    const body=await request.json();
    if(typeof body.approve!=="boolean"||typeof body.id!=="string"||!/^[a-f\d-]{36}$/i.test(body.id)) return failure("신청을 선택해주세요.",400);
    if(body.approve&&(!Number.isSafeInteger(Number(body.rosterId))||Number(body.rosterId)<=0)) return failure("확인한 명단을 선택해주세요.",400);
    const result=await getServerSupabase().rpc("sg_review_academy",{p_request:body.id,p_actor:teacher,p_approve:body.approve,p_roster:body.approve?Number(body.rosterId):null});
    if(result.error) return failure(result.error.message.includes("existing_student")?"기존 학생 계정이 있습니다. 학생에게 기존 계정 로그인 후 카카오 연결을 안내해주세요. 이 신청은 반려할 수 있습니다.":"이미 처리된 신청이거나 명단·담당 선생님이 일치하지 않습니다.",409);
    return NextResponse.json({ok:true});
  } catch { return failure(); }
}
