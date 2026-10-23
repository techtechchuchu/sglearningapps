import { NextResponse } from "next/server";
// Existing student login remains unchanged; new accounts must not gain academy access here.
export async function POST() {
  return NextResponse.json({message:"신규 가입은 이메일 인증을 이용해주세요. 학원 연결 승인 후 카카오를 연결할 수 있습니다."},{status:410});
}
