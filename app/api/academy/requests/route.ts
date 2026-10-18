import { NextRequest, NextResponse } from "next/server";
import { equalSecret, failure, memberContext, rateLimit, sameOrigin } from "../../../../lib/member-auth";
import { staffSession } from "../../../../lib/staff-access";
import { getServerSupabase } from "../../../../lib/supabase-server";
const teachers=["이주백.T","박병민.T","노대근.T"];
function assignment(body:Record<string,unknown>) {
  const className=String(body.className||"").trim();
  const school=String(body.school||"").trim();
  const grade=String(body.grade||"").trim();
  const books=Array.isArray(body.books)?[...new Set(body.books.map(value=>String(value||"").trim()).filter(Boolean))]:[];
  if(className.length>120||school.length>120||grade.length>30||books.length>20||
    books.some(book=>book.length>120)) return null;
  return {className,school,grade,books};
}

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
    const requested=assignment(body);
    if(!name||name.length>60||!teachers.includes(teacher)||!requested||!requested.className||!requested.books.length)
      return failure("학생 이름·담당 선생님·반·교재를 확인해주세요.",400);
    const catalog=await auth.db.from("book_master").select("book_name").eq("is_active",true).in("book_name",requested.books);
    if(catalog.error) throw catalog.error;
    if(catalog.data?.length!==requested.books.length) return failure("사용 중인 교재만 선택해주세요.",400);
    // Compare-and-set: only this member's rejected request may return to pending.
    // Concurrent retries cannot overwrite a pending or approved request.
    const retried=await auth.db.from("sg_academy_requests").update({
      student_name:name,teacher_name:teacher,school:requested.school,grade:requested.grade,
      requested_class:requested.className,requested_books:requested.books,
      status:"pending",reviewer:null,reviewed_at:null,created_at:new Date().toISOString(),
    }).eq("user_id",auth.user.id).eq("status","rejected").select("id");
    if(retried.error) throw retried.error;
    if(retried.data?.length) return NextResponse.json({ok:true,message:"학원 연결을 다시 신청했습니다. 담당 선생님의 승인을 기다려주세요."});
    const result=await auth.db.from("sg_academy_requests").insert({user_id:auth.user.id,student_name:name,teacher_name:teacher,school:requested.school,grade:requested.grade,requested_class:requested.className,requested_books:requested.books});
    if(result.error?.code==="23505") return failure("이미 신청한 내역이 있습니다. 상태를 확인하거나 학원에 문의해주세요.",409);
    if(result.error) throw result.error;
    return NextResponse.json({ok:true,message:"SG고등관 연결 신청을 접수했습니다. 승인 전에는 학원 자료에 접근할 수 없습니다."});
  } catch { return failure(); }
}
export async function GET(request:NextRequest) {
  try {
    const teacher=staffSession(request);
    const db=getServerSupabase();
    if(!teacher) {
      const auth=await memberContext(request);
      if(!auth) return failure("로그인이 필요합니다.",401);
      const books=await db.from("book_master").select("book_name").eq("is_active",true).order("book_name").limit(500);
      if(books.error) throw books.error;
      return NextResponse.json({books:books.data?.map(row=>row.book_name)||[]},{headers:{"Cache-Control":"no-store"}});
    }
    if(!teachers.includes(teacher)&&teacher!=="전체 관리자") return failure("선생님 로그인이 필요합니다.",401);
    let query=db.from("sg_academy_requests").select("id,student_name,teacher_name,school,grade,requested_class,requested_books,status,created_at").eq("status","pending");
    let roster=db.from("student_roster").select("id,student_name,teacher_name,class_name,school_name,grade").neq("enrollment_status","퇴원");
    if(teacher!=="전체 관리자"){query=query.eq("teacher_name",teacher);roster=roster.eq("teacher_name",teacher);}
    const [requests,rows,books]=await Promise.all([query.order("created_at"),roster.limit(2000),db.from("book_master").select("book_name").eq("is_active",true).order("book_name").limit(500)]);
    if(requests.error||rows.error||books.error) throw requests.error||rows.error||books.error;
    return NextResponse.json({requests:requests.data,roster:rows.data,books:books.data?.map(row=>row.book_name)||[]},{headers:{"Cache-Control":"no-store"}});
  } catch { return failure(); }
}
export async function PUT(request:NextRequest) {
  if(!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  try {
    const auth=await memberContext(request);
    if(!auth||auth.user.academy_username) return failure("신청 계정으로 로그인해주세요.",401);
    if(!await rateLimit(request,"academy-edit",20,auth.user.id)) return failure("잠시 후 다시 수정해주세요.",429);
    const requested=assignment(await request.json());
    if(!requested||!requested.className||!requested.books.length) return failure("반과 교재를 입력해주세요.",400);
    const catalog=await auth.db.from("book_master").select("book_name").eq("is_active",true).in("book_name",requested.books);
    if(catalog.error) throw catalog.error;
    if(catalog.data?.length!==requested.books.length) return failure("사용 중인 교재만 선택해주세요.",400);
    const updated=await auth.db.from("sg_academy_requests").update({requested_class:requested.className,requested_books:requested.books,school:requested.school,grade:requested.grade})
      .eq("user_id",auth.user.id).eq("status","pending").select("id");
    if(updated.error) throw updated.error;
    if(!updated.data?.length) return failure("승인 대기 중인 신청을 찾지 못했습니다. 상태를 다시 확인해주세요.",409);
    return NextResponse.json({ok:true,message:"신청 정보를 수정했습니다. 담당 선생님 또는 전체관리자가 확인합니다."});
  } catch { return failure(); }
}
export async function PATCH(request:NextRequest) {
  if(!sameOrigin(request)) return failure("잘못된 요청입니다.",403);
  try {
    const teacher=staffSession(request);
    if(!teacher||(!teachers.includes(teacher)&&teacher!=="전체 관리자")) return failure("선생님 로그인이 필요합니다.",401);
    const body=await request.json();
    if(typeof body.approve!=="boolean"||typeof body.id!=="string"||!/^[a-f\d-]{36}$/i.test(body.id)) return failure("신청을 선택해주세요.",400);
    if(body.approve&&body.newRoster===true) {
      const requested=assignment(body);
      if(!requested||!requested.className||!requested.books.length) return failure("신규 명단의 반과 교재를 확인해주세요.",400);
      const created=await getServerSupabase().rpc("sg_register_and_review_academy",{
        p_request:body.id,p_actor:teacher,p_class:requested.className,p_school:requested.school,p_grade:requested.grade,p_books:requested.books
      });
      if(created.error) {
        const message=created.error.message;
        if(message.includes("existing_student")) return failure("기존 학생 계정이 있습니다. 기존 계정으로 로그인해 카카오를 연결하도록 안내해주세요.",409);
        if(message.includes("roster_exists")) return failure("이미 등록된 명단이 있습니다. 새로고침한 뒤 기존 명단을 선택해주세요.",409);
        return failure("신규 명단 등록과 승인을 완료하지 못했습니다. 신청 상태·반·교재를 확인해주세요.",409);
      }
      return NextResponse.json({ok:true,rosterId:created.data});
    }
    if(body.approve&&(!Number.isSafeInteger(Number(body.rosterId))||Number(body.rosterId)<=0)) return failure("확인한 명단을 선택해주세요.",400);
    const result=await getServerSupabase().rpc("sg_review_academy",{p_request:body.id,p_actor:teacher,p_approve:body.approve,p_roster:body.approve?Number(body.rosterId):null});
    if(result.error) return failure(result.error.message.includes("existing_student")?"기존 학생 계정이 있습니다. 학생에게 기존 계정 로그인 후 카카오 연결을 안내해주세요. 이 신청은 반려할 수 있습니다.":"이미 처리된 신청이거나 명단·담당 선생님이 일치하지 않습니다.",409);
    return NextResponse.json({ok:true});
  } catch { return failure(); }
}
