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
  const [holding, setHolding] = useState(false);
  const skipTour = useRef(false);
  useEffect(() => {
    const scene = root.current;
    if (!scene) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let step = -1;
    let until = 0;
    let touchY = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const advance = (event: Event, delta: number) => {
      if (skipTour.current || reduced.matches || delta <= 0 || !event.cancelable) return;
      const rect = scene.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const travel = Math.max(1, rect.height - window.innerHeight);
      if (window.scrollY > start + travel + 3 || rect.top > window.innerHeight / 2) return;
      event.preventDefault();
      if (performance.now() < until) return;
      if (step >= 2) {
        skipTour.current = true;
        setHolding(false);
        document.getElementById("partners")?.scrollIntoView({ behavior: "auto" });
        return;
      }
      step += 1;
      window.scrollTo({ top: start + [0, .52, 1][step] * travel, behavior: "instant" });
      until = performance.now() + 1500;
      setHolding(true);
      clearTimeout(timer);
      timer = setTimeout(() => setHolding(false), 1500);
    };
    const wheel = (event: WheelEvent) => { if (!event.ctrlKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) advance(event, event.deltaY); };
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const delta = touchY - y;
      if (Math.abs(delta) > 8) { advance(event, delta); touchY = y; }
    };
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("a,button,input,select,textarea,[contenteditable]")) return;
      if (!event.shiftKey && ["ArrowDown", "PageDown", " ", "End"].includes(event.key)) advance(event, 100);
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("keydown", key);
    };
  }, []);
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
      setPhase(progress < .27 ? 0 : progress < .66 ? 1 : 2);
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
        <p className="scene-caption">{holding ? "잠시 장면을 감상해 주세요 · 1.5초" : "아래로 스크롤하면 다음 장면으로 이어집니다."}</p>
        <a className="scene-skip" href="#partners" onClick={() => { skipTour.current = true; setHolding(false); }}>소개 건너뛰기 ↓</a>
      </div>

      <div className="scene-world" aria-label="학습 기록이 모여 개인 노트와 교실로 이어지는 브랜드 애니메이션. 아래 내용은 예시입니다.">
        <div className="scene-ring ring-one" aria-hidden="true"/><div className="scene-ring ring-two" aria-hidden="true"/>
        <span className="scene-star star-one" aria-hidden="true">✳</span><span className="scene-star star-two" aria-hidden="true">✦</span>
        <div className="orbit-object object-math"><div className="floating-object subject-tile"><small>MATHEMATICS</small><b>ƒ(x)</b><span>생각의 깊이를 더해요</span></div></div>
        <div className="orbit-object object-english"><div className="floating-object subject-tile"><small>LANGUAGE</small><b>Aa<span>↗</span></b><span>새로운 세상을 읽어요</span></div></div>
        <div className="orbit-object object-science"><div className="floating-object subject-tile"><small>SCIENCE</small><b>H₂O</b><span>질문에서 시작해요</span></div></div>
        <div className="orbit-object object-book"><div className="floating-object scene-book"><span>MY OWN<br/>LEARNING</span><BookOpen size={36}/><b>배움의 결</b><small>STUDY GYEOL</small></div></div>
        <div className="orbit-object object-memo"><div className="floating-object scene-memo"><span>오늘의 발견</span><b>틀려도 괜찮아.<br/>다시 알게 됐으니까.</b><span className="memo-line"/><span className="memo-line"/></div></div>
        <div className="scene-notebook">
          <div className="notebook-spine" aria-hidden="true"/>
          <div className="notebook-top"><span><BookOpen size={18}/> {phase === 2 ? "우리의 학습 공간" : "나의 학습 노트"}</span><small>화면 예시</small></div>
          <div className="notebook-title">배움이 쌓이는 순간,<br/><strong>가능성은 자라나요.</strong></div>
          <div className="notebook-rule"/>
          <div className="notebook-row"><span>01</span><div><b>다시 생각한 문제</b><small>이해하는 만큼, 한 걸음 더</small></div><Check size={18}/></div>
          <div className="notebook-row"><span>02</span><div><b>오늘 발견한 개념</b><small>나의 언어로 남기는 배움</small></div><Check size={18}/></div>
          <div className="notebook-row"><span>03</span><div><b>함께 나눌 질문</b><small>선생님과 이어가는 다음 공부</small></div><Check size={18}/></div>
          <div className="notebook-seal"><Sparkles size={16}/> 어제보다 한 결 더.</div>
        </div>
        <div className="classroom-card class-one"><span className="class-avatar">나</span><div><b>나의 기록</b><small>나만의 속도로 차곡차곡</small></div></div>
        <div className="classroom-card class-two"><span className="class-avatar">함께</span><div><b>함께 배우는 교실</b><small>질문과 피드백이 이어지는 곳</small></div></div>
        <div className="classroom-card class-three"><span className="class-avatar">결</span><div><b>성장을 보는 선생님</b><small>한 명 한 명의 배움을 가까이</small></div></div>
      </div>
      <div className="scene-bottom"><a href="#choose" className="scene-scroll"><ArrowDown size={16}/><span>스크롤하며 배움의 여정을 만나보세요</span></a><div className="scene-steps" aria-label={`학습 이야기 ${phase + 1} / 3`}><span className={phase === 0 ? "active" : ""}/><span className={phase === 1 ? "active" : ""}/><span className={phase === 2 ? "active" : ""}/></div><button className="scene-pause" onClick={() => setPaused(p => !p)} aria-label={paused ? "자동 움직임 재생" : "자동 움직임 멈추기"} aria-pressed={paused}>{paused ? <Play size={14}/> : <Pause size={14}/>}<span>{paused ? "재생" : "일시정지"}</span></button></div>
    </div>
  </section>;
}
