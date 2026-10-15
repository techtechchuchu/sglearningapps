"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, BookOpen, Check, Pause, Play, Sparkles } from "lucide-react";
import "./learning-scene.css";

const chapters = [
  { label: "01 / DISCOVER YOUR WAY", title: <>공부에도,<br/>나만의 <em>결</em>이 있다.</>, description: "흩어진 배움의 순간들이, 나만의 가능성이 되도록." },
  { label: "02 / CONNECT YOUR LEARNING", title: <>흩어진 기록이,<br/>하나의 <em>실력</em>으로.</>, description: "틀린 문제도, 이해한 순간도. 나를 알아가는 공부의 기록." },
  { label: "03 / GROW TOGETHER", title: <>나의 성장이,<br/>우리의 <em>성장</em>으로.</>, description: "혼자 공부하는 오늘부터, 함께 배우는 교실까지." },
];

export default function LearningScene() {
  const root = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState(0);
  useEffect(() => {
    const scene = root.current;
    if (!scene) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = scene.getBoundingClientRect();
      const progress = motion.matches ? 0 : Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - window.innerHeight)));
      scene.style.setProperty("--gather", String(Math.min(1, progress / .52)));
      scene.style.setProperty("--classroom", String(Math.max(0, (progress - .58) / .42)));
      const nextPhase = progress < .27 ? 0 : progress < .66 ? 1 : 2;
      setPhase(nextPhase);
      setScreen(nextPhase);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <section ref={root} className={`learning-story${paused ? " scene-paused" : ""}`} data-phase={phase} aria-label="스터디결 학습 이야기">
    <div className="learning-stage">
      <div className="scene-grid" aria-hidden="true"/>
      <div className="scene-halo" aria-hidden="true"/>
      <div className="scene-copy">
        <p className="scene-kicker">LEARNING HAS ITS OWN TEXTURE</p>
        <div key={phase} className="scene-chapter">
          <p className="scene-chapter-label">{chapters[phase].label}</p>
          <h1>{chapters[phase].title}</h1>
          <p className="scene-description">{chapters[phase].description}</p>
        </div>
        <a className="scene-cta" href="#choose">나에게 맞는 스터디결 <ArrowUpRight size={19}/></a>
        <p className="scene-caption">아래로 스크롤하면 스터디결의 기능을 만날 수 있어요.</p>
        <a className="scene-skip" href="#partners">소개 건너뛰기 ↓</a>
      </div>

      <div className="scene-world" aria-label="학습 기록이 모여 개인 노트와 교실로 이어지는 브랜드 애니메이션. 아래 내용은 예시입니다.">
        <div className="scene-ring ring-one" aria-hidden="true"/><div className="scene-ring ring-two" aria-hidden="true"/>
        <span className="scene-star star-one" aria-hidden="true">✳</span><span className="scene-star star-two" aria-hidden="true">✦</span>
        <div className="orbit-object object-math"><div className="floating-object subject-tile"><small>WRONG ANSWERS</small><b>✎</b><span>내 오답을 다시 살펴봐요</span></div></div>
        <div className="orbit-object object-english"><div className="floating-object subject-tile"><small>QUESTIONS</small><b>?</b><span>선생님께 질문을 남겨요</span></div></div>
        <div className="orbit-object object-science"><div className="floating-object subject-tile"><small>ATTENDANCE</small><b>✓</b><span>오늘의 출석을 확인해요</span></div></div>
        <div className="orbit-object object-book"><div className="floating-object scene-book"><span>MY OWN<br/>LEARNING</span><BookOpen size={36}/><b>학습 기록</b><small>STUDY GYEOL</small></div></div>
        <div className="orbit-object object-memo"><div className="floating-object scene-memo"><span>이번 주의 기록</span><b>공부한 날들을<br/>한눈에 살펴봐요.</b><span className="memo-line"/><span className="memo-line"/></div></div>
        <div className="scene-phone" aria-label="스터디결 모바일 화면 미리보기">
          <div className="scene-phone-camera" aria-hidden="true"/>
          <div className="scene-phone-screen">
            <div className="phone-status"><span>9:41</span><span>●●● ▰</span></div>
            <div className="phone-app-head"><span className="phone-app-mark">결</span><b>스터디결</b><span>✦</span></div>
            <div key={screen} className="phone-content">
              {screen === 0 && <><small>오늘의 학습</small><h2>오늘도 나만의<br/>공부를 이어가요.</h2><p>오답과 학습 기록을 한곳에서 확인하세요.</p><div className="phone-stat-grid"><div><b>오답 작성</b><span>틀린 문제를 기록해요</span></div><div><b>주간 학습기록</b><span>공부한 날을 돌아봐요</span></div></div><div className="phone-list"><span>최근 학습 기록</span><b>내가 남긴 오답 다시 보기 →</b></div></>}
              {screen === 1 && <><small>내 오답노트</small><h2>틀린 문제도<br/>내 공부의 일부.</h2><p>교재를 고르고 문제 번호와 풀이를 남겨요.</p><div className="phone-field"><span>교재</span><b>X-패턴 공통수학2</b></div><div className="phone-field"><span>문제 번호</span><b>9번</b></div><div className="phone-note">왜 틀렸는지 적고 다시 복습해요.</div></>}
              {screen === 2 && <><small>함께하는 공부</small><h2>질문하고,<br/>출석도 확인해요.</h2><p>질문함과 출석 기록을 학생 화면에서 확인하세요.</p><div className="phone-field"><span>질문함</span><b>궁금한 점을 선생님께 →</b></div><div className="phone-field"><span>출석 체크</span><b>오늘의 출석 확인 →</b></div><div className="phone-note">선생님과 학습 기록을 이어갑니다.</div></>}
            </div>
            <div className="phone-tabs" aria-label="미리보기 화면 선택"><button type="button" className={screen === 0 ? "active" : ""} onClick={() => setScreen(0)}>오늘</button><button type="button" className={screen === 1 ? "active" : ""} onClick={() => setScreen(1)}>오답</button><button type="button" className={screen === 2 ? "active" : ""} onClick={() => setScreen(2)}>질문·출석</button></div>
          </div>
        </div>
        <div className="classroom-card class-one"><span className="class-avatar">나</span><div><b>나의 기록</b><small>나만의 속도로 차곡차곡</small></div></div>
        <div className="classroom-card class-two"><span className="class-avatar">함께</span><div><b>함께 배우는 교실</b><small>질문과 피드백이 이어지는 곳</small></div></div>
        <div className="classroom-card class-three"><span className="class-avatar">결</span><div><b>성장을 보는 선생님</b><small>한 명 한 명의 배움을 가까이</small></div></div>
      </div>
      <div className="scene-bottom"><a href="#choose" className="scene-scroll"><ArrowDown size={16}/><span>스크롤하며 배움의 여정을 만나보세요</span></a><div className="scene-steps" aria-label={`학습 이야기 ${phase + 1} / 3`}><span className={phase === 0 ? "active" : ""}/><span className={phase === 1 ? "active" : ""}/><span className={phase === 2 ? "active" : ""}/></div><button className="scene-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? "자동 움직임 재생" : "자동 움직임 멈추기"} aria-pressed={paused}>{paused ? <Play size={14}/> : <Pause size={14}/>}<span>{paused ? "재생" : "일시정지"}</span></button></div>
    </div>
  </section>;
}

