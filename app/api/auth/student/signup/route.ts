import { NextResponse } from "next/server";
// Existing student login remains unchanged; new accounts must not gain academy access here.
export async function POST() {
  return NextResponse.json({message:"신규 가입은 카카오 또는 이메일 인증을 이용해주세요. 가입 후 별도로 학원 연결을 신청할 수 있습니다."},{status:410});
}
