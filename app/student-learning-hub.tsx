"use client";

import { useEffect, useState } from "react";
import { displayProblemNumbers } from "../lib/wrong-answers";
import GyeolgyeoliChat from "./gyeolgyeoli-chat";
import "./student-notice-carousel.css";

type RecordRow = { id?: number; unit?: string; problem?: string; memo?: string; created_at?: string };
type SchoolRow = { id: number; problem?: string; created_at?: string };
type View = "home" | "weekly" | "helper";

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const days = ["일", "월", "화", "수", "목", "금", "토"];

const notices = [
  { id: "winter", kind: "blog", title: "2027 겨울방학 수학·과학 시간표", description: "예비고1·2·3 겨울방학 수업 시간표를 확인하세요.", image: "/sg-blog-winter-2027.png", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224465437422&redirect=Dlog" },
  { id: "prehigh", kind: "blog", title: "예비고1 겨울방학 수업·입반 테스트", description: "수업 시간표와 입반 테스트 안내를 확인하세요.", image: "/sg-blog-prehigh-2027.png", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224465314793&redirect=Dlog" },
  { id: "startplan", kind: "blog", title: "2027 SG 예비고1 스타트플랜 설명회", description: "11월 18일 차오름센터 설명회 안내를 확인하세요.", image: "/sg-blog-startplan-2027.jpg", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224442015757&redirect=Dlog" },
  { id: "premium", kind: "blog", title: "고1 11월 전국모의고사 현장 응시", description: "THE PREMIUM 전국모의고사 현장 응시 안내를 확인하세요.", image: "/sg-blog-premium-2026.png", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224437617530&redirect=Dlog" },
  { id: "home", kind: "home", title: "아이폰 홈 화면에서 스터디결 바로 열기", description: "Safari에서 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요." },
  { id: "ai", kind: "ai", title: "AI 상담사 결결이를 이용해 보세요", description: "공부 계획과 오답 복습을 질문할 수 있고, 대화는 날짜별 기록에서 다시 볼 수 있어요." },
] as const;

function StudentNoticeCarousel({ onOpenAI, showAI }: { onOpenAI: () => void; showAI: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const visibleNotices = showAI ? notices : notices.filter((item) => item.kind !== "ai");
  const notice = visibleNotices[index] || visibleNotices[0];

  useEffect(() => {
    if (paused || interacting || showGuide || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((current) => (current + 1) % visibleNotices.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [index, paused, interacting, showGuide, visibleNotices.length]);

  function select(next: number) {
    setIndex((next + visibleNotices.length) % visibleNotices.length);
    setShowGuide(false);
  }

  return <section className={`student-notice-carousel student-notice-${notice.kind}`} aria-label="공지사항" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setInteracting(false); }}>
    <div className="student-notice-poster" key={index}>
      <div className="student-notice-heading"><strong>스터디결 공지사항</strong><span>{index + 1} / {visibleNotices.length}</span></div>
      <div className="student-notice-visual" aria-hidden="true">{notice.kind === "blog" ? <img className="student-notice-blog-image" src={notice.image} alt="" /> : notice.kind === "home" ? <div className="student-notice-phone"><span className="student-notice-phone-speaker" /><span className="student-notice-phone-mark">결</span><small>스터디결</small></div> : <div className="student-notice-ai-mark"><span>결</span><i /><i /></div>}</div>
      <div className="student-notice-content" aria-live="off"><span className="student-notice-eyebrow">{notice.kind === "blog" ? "학원 소식" : notice.kind === "home" ? "아이폰 이용 안내" : "AI 학습 도우미"}</span><h2>{notice.title}</h2><p>{notice.description}</p>
        {notice.kind === "blog" ? <span className="student-notice-link">공지 자세히 보기 →</span> : notice.kind === "home" ? <><button type="button" className="student-notice-link" aria-expanded={showGuide} onClick={() => setShowGuide((current) => !current)}>{showGuide ? "안내 접기" : "홈 화면 추가 방법 보기 →"}</button>{showGuide && <ol className="student-notice-steps"><li>아이폰의 Safari에서 스터디결 사이트를 엽니다.</li><li>공유 버튼을 누르고 ‘홈 화면에 추가’를 선택합니다.</li><li>‘웹 앱으로 열기’를 켠 뒤 ‘추가’를 누릅니다.</li></ol>}</> : <button type="button" className="student-notice-link" onClick={onOpenAI}>결결이에게 질문하기 →</button>}
      </div>
      {notice.kind === "blog" && <a className="student-notice-blog-overlay" href={notice.url} target="_blank" rel="noopener noreferrer" aria-label={`${notice.title} 네이버 블로그 글 새 창에서 열기`} />}
    </div>
    <div className="student-notice-controls"><button type="button" onClick={() => select(index - 1)} aria-label="이전 공지">←</button><div role="group" aria-label="공지 선택">{visibleNotices.map((item, noticeIndex) => <button type="button" key={item.id} className={index === noticeIndex ? "active" : ""} aria-label={`${noticeIndex + 1}번 공지: ${item.title}`} aria-pressed={index === noticeIndex} onClick={() => select(noticeIndex)} />)}</div><button type="button" onClick={() => select(index + 1)} aria-label="다음 공지">→</button><button type="button" className="student-notice-pause" aria-label={paused ? "공지 자동 넘김 재생" : "공지 자동 넘김 일시정지"} onClick={() => setPaused((current) => !current)}>{paused ? "▶" : "Ⅱ"}</button></div>
  </section>;
}

export default function StudentLearningHub({ view, name, answers, schoolAnswers, onNavigate, showAI = false }: { view: View; name: string; answers: RecordRow[]; schoolAnswers: SchoolRow[]; onNavigate: (tab: "wrong" | "learn" | "questions" | "attendance" | "helper") => void; showAI?: boolean }) {
  const now = new Date();
  const today = dayKey(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  const timeline = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return { key: dayKey(date), label: `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})` }; });
  const activity = [...answers.map((row) => ({ id: `wrong-${row.id}`, at: row.created_at || "", label: `${row.unit || "교재"} · ${displayProblemNumbers(row.unit || "", row.problem || "")}번`, kind: "오답" })), ...schoolAnswers.map((row) => ({ id: `school-${row.id}`, at: row.created_at || "", label: `학교 기출 · ${row.problem || "?"}번`, kind: "학교 기출" }))].sort((a, b) => b.at.localeCompare(a.at));
  const counts = new Map(timeline.map(({ key }) => [key, 0]));
  for (const row of activity) { const key = row.at ? dayKey(new Date(row.at)) : ""; if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1); }
  const weekTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const todayTotal = counts.get(today) || 0;

  if (view === "home") return <div className="learning-hub">
    <StudentNoticeCarousel onOpenAI={() => onNavigate("helper")} showAI={showAI} />
    <section className="panel learning-hero"><span className="badge">오늘의 학습</span><h2>{name} 학생, 오늘은 무엇을 공부할까요?</h2><p>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "full" }).format(now)} · 최근 7일 동안 기록한 학습을 바탕으로 보여드립니다.</p><div className="learning-metrics"><article><b>{todayTotal}</b><span>오늘 기록</span></article><article><b>{weekTotal}</b><span>최근 7일 기록</span></article><article><b>{answers.length}</b><span>누적 오답</span></article></div></section>
    <section className="panel"><h2>바로 시작하기</h2><div className="learning-actions"><button type="button" onClick={() => onNavigate("wrong")}>✏️ 오답 작성</button><button type="button" onClick={() => onNavigate("learn")}>▶️ 문제별 해설</button><button type="button" onClick={() => onNavigate("questions")}>💬 선생님께 질문</button><button type="button" onClick={() => onNavigate("attendance")}>📍 출석 확인</button></div></section>
    <section className="panel"><h2>최근 학습 기록</h2>{activity.length ? activity.slice(0, 5).map((row) => <div className="row" key={row.id}><strong>{row.label}</strong><span>{row.kind} · {row.at ? new Date(row.at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "날짜 미상"}</span></div>) : <p>아직 기록이 없습니다. 첫 오답을 작성해 보세요.</p>}</section>
  </div>;

  if (view === "weekly") return <div className="learning-hub"><section className="panel"><span className="badge">주간 학습기록</span><h2>최근 7일의 공부 흔적</h2><p>오답 작성과 학교 기출 저장 기록을 날짜별로 집계합니다. 공부 시간이나 진도는 아직 자동 측정하지 않습니다.</p><div className="learning-metrics"><article><b>{weekTotal}</b><span>저장한 기록</span></article><article><b>{[...counts.values()].filter(Boolean).length}</b><span>기록한 날</span></article><article><b>{activity.filter((row) => row.at && counts.has(dayKey(new Date(row.at))) && row.kind === "학교 기출").length}</b><span>학교 기출 기록</span></article></div><div className="learning-week">{timeline.map(({ key, label }) => <div className="learning-day" key={key}><span>{label}</span><b>{counts.get(key) || 0}건</b><div className="learning-bar-track"><div style={{ width: `${Math.min(100, ((counts.get(key) || 0) / Math.max(1, ...counts.values())) * 100)}%` }} /></div></div>)}</div></section></div>;

  return <GyeolgyeoliChat name={name} />;
}

