import type { Metadata } from "next";
import { cookies } from "next/headers";
import { homepageAccessIsConfigured, HOMEPAGE_COOKIE, verifyHomepageAccessToken } from "../../lib/homepage-access";
import { unlockHomepage } from "./actions";
import LandingView from "./landing-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "공식 홈페이지 | 스터디결", robots: { index: false, follow: false } };

export default async function Homepage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get(HOMEPAGE_COOKIE)?.value;
  if (verifyHomepageAccessToken(token)) return <LandingView />;

  const configured = homepageAccessIsConfigured();
  const { error } = await searchParams;
  return <main className="shell"><section className="login-card" aria-labelledby="home-access-title">
    <div className="brand"><p className="badge">STUDY GYEOL</p><h1 id="home-access-title">공식 홈페이지 준비 중</h1><p>현재 공식 홈페이지는 초대받은 분만 확인할 수 있습니다. 학생·선생님 로그인은 정상적으로 이용할 수 있습니다.</p></div>
    {configured ? <form action={unlockHomepage} className="form">
      <label>홈페이지 접속 비밀번호<input name="password" type="password" autoComplete="current-password" minLength={16} maxLength={256} required /></label>
      <button className="primary" type="submit">홈페이지 보기</button>
      {error === "invalid" && <p className="alert" role="alert">비밀번호가 맞지 않습니다.</p>}
    </form> : <p className="safe-note" role="status">홈페이지 공개 준비 중입니다.</p>}
    <p><a href="/#login-student">학생 로그인</a> · <a href="/#login-teacher">선생님·관리자 로그인</a> · <a href="/#login-university">대학생 로그인</a></p>
  </section></main>;
}

