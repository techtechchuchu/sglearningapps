"use client";

import { useEffect, useState } from "react";
import "./student-notice-carousel.css";

export type StudentHomeSlide = {
  id: string;
  kind: "blog" | "home" | "ai" | "custom" | "notice";
  title: string;
  description: string;
  eyebrow?: string;
  image?: string;
  url?: string;
};

const fallbackSlides: StudentHomeSlide[] = [
  { id: "winter", kind: "blog", title: "2027 겨울방학 수학·과학 시간표", description: "예비고1·2·3 겨울방학 수업 시간표를 확인하세요.", eyebrow: "학원 소식", image: "/sg-blog-winter-2027.png", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224465437422&redirect=Dlog" },
  { id: "prehigh", kind: "blog", title: "예비고1 겨울방학 수업·입반 테스트", description: "수업 시간표와 입반 테스트 안내를 확인하세요.", eyebrow: "학원 소식", image: "/sg-blog-prehigh-2027.png", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224465314793&redirect=Dlog" },
  { id: "startplan", kind: "blog", title: "2027 SG 예비고1 스타트플랜 설명회", description: "11월 18일 차오름센터 설명회 안내를 확인하세요.", eyebrow: "학원 소식", image: "/sg-blog-startplan-2027.jpg", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224442015757&redirect=Dlog" },
  { id: "premium", kind: "blog", title: "고1 11월 전국모의고사 현장 응시", description: "THE PREMIUM 전국모의고사 현장 응시 안내를 확인하세요.", eyebrow: "학원 소식", image: "/sg-blog-premium-2026.png", url: "https://blog.naver.com/PostView.naver?blogId=ulsansgg&logNo=224437617530&redirect=Dlog" },
  { id: "home", kind: "home", title: "아이폰 홈 화면에서 스터디결 바로 열기", description: "Safari에서 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요.", eyebrow: "아이폰 이용 안내" },
  { id: "ai", kind: "ai", title: "앱 사용이 어려우신가요?", description: "결결이에게 스터디결 사용법과 이용 중 불편한 점을 물어보세요.", eyebrow: "AI 앱 이용 안내" },
];

export default function StudentNoticeCarousel({ onOpenAI, showAI, previewSlides }: { onOpenAI: () => void; showAI: boolean; previewSlides?: StudentHomeSlide[] }) {
  const [slides, setSlides] = useState<StudentHomeSlide[]>(fallbackSlides);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (previewSlides) return;
    let mounted = true;
    void fetch("/api/student/home-slides", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("슬라이드 조회 실패"); return response.json(); })
      .then((result) => { if (mounted && Array.isArray(result.slides)) { setSlides(result.slides); setIndex(0); } })
      .catch(() => { /* Keep the existing slides if the service is temporarily unavailable. */ });
    return () => { mounted = false; };
  }, [previewSlides]);

  const visibleNotices = (previewSlides || slides).filter((item) => showAI || item.kind !== "ai");
  const safeIndex = Math.min(index, Math.max(0, visibleNotices.length - 1));
  const notice = visibleNotices[safeIndex];

  useEffect(() => {
    if (previewSlides || !visibleNotices.length || paused || interacting || showGuide || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((current) => (current + 1) % visibleNotices.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [previewSlides, safeIndex, paused, interacting, showGuide, visibleNotices.length]);

  function select(next: number) {
    if (!visibleNotices.length) return;
    setIndex((next + visibleNotices.length) % visibleNotices.length);
    setShowGuide(false);
  }
  if (!notice) return null;
  const imageSlide = notice.kind === "blog" || notice.kind === "custom";
  const visual = imageSlide && notice.image
    ? <img className="student-notice-blog-image" src={notice.image} alt="" />
    : notice.kind === "home"
      ? <div className="student-notice-phone"><span className="student-notice-phone-speaker" /><span className="student-notice-phone-mark">결</span><small>스터디결</small></div>
      : <div className="student-notice-ai-mark"><span>결</span><i /><i /></div>;

  return <section className={`student-notice-carousel student-notice-${imageSlide ? "blog" : notice.kind}`} aria-label="공지사항" onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)} onFocusCapture={() => setInteracting(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setInteracting(false); }}>
    <div className="student-notice-poster" key={notice.id}>
      <div className="student-notice-heading"><strong>스터디결 공지사항</strong><span>{safeIndex + 1} / {visibleNotices.length}</span></div>
      <div className="student-notice-visual" aria-hidden="true">{visual}</div>
      <div className="student-notice-content" aria-live="off"><span className="student-notice-eyebrow">{notice.eyebrow || (imageSlide ? "학원 소식" : "공지사항")}</span><h2>{notice.title}</h2><p>{notice.description}</p>
        {notice.url ? <span className="student-notice-link">공지 자세히 보기 →</span> : notice.kind === "home" ? <><button type="button" className="student-notice-link" aria-expanded={showGuide} onClick={() => setShowGuide((current) => !current)}>{showGuide ? "안내 접기" : "홈 화면 추가 방법 보기 →"}</button>{showGuide && <ol className="student-notice-steps"><li>아이폰의 Safari에서 스터디결 사이트를 엽니다.</li><li>공유 버튼을 누르고 ‘홈 화면에 추가’를 선택합니다.</li><li>‘웹 앱으로 열기’를 켠 뒤 ‘추가’를 누릅니다.</li></ol>}</> : notice.kind === "ai" ? <button type="button" className="student-notice-link" onClick={onOpenAI}>결결이에게 질문하기 →</button> : null}
      </div>
      {notice.url && <a className="student-notice-blog-overlay" href={notice.url} target="_blank" rel="noopener noreferrer" aria-label={`${notice.title} 새 창에서 열기`} />}
    </div>
    {!previewSlides && <div className="student-notice-controls"><button type="button" onClick={() => select(safeIndex - 1)} aria-label="이전 공지">←</button><div role="group" aria-label="공지 선택">{visibleNotices.map((item, noticeIndex) => <button type="button" key={item.id} className={safeIndex === noticeIndex ? "active" : ""} aria-label={`${noticeIndex + 1}번 공지: ${item.title}`} aria-pressed={safeIndex === noticeIndex} onClick={() => select(noticeIndex)} />)}</div><button type="button" onClick={() => select(safeIndex + 1)} aria-label="다음 공지">→</button><button type="button" className="student-notice-pause" aria-label={paused ? "공지 자동 넘김 재생" : "공지 자동 넘김 일시정지"} onClick={() => setPaused((current) => !current)}>{paused ? "▶" : "Ⅱ"}</button></div>}
  </section>;
}
