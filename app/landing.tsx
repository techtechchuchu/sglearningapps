import { ArrowUpRight, ArrowRight, BookOpen, GraduationCap, Layers3, Sparkles, Check, Building2 } from "lucide-react";
import type { PointerEvent } from "react";
import "./note-motion.css";

type Props = { onLogin: (mode: "student" | "teacher") => void };

function tiltNote(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const x = Math.max(-0.5, Math.min(0.5, (event.clientX - bounds.left) / bounds.width - 0.5));
  const y = Math.max(-0.5, Math.min(0.5, (event.clientY - bounds.top) / bounds.height - 0.5));
  event.currentTarget.style.setProperty("--note-rx", `${-y * 12}deg`);
  event.currentTarget.style.setProperty("--note-ry", `${x * 14}deg`);
}

function resetNote(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.removeProperty("--note-rx");
  event.currentTarget.style.removeProperty("--note-ry");
}

export default function Landing({ onLogin }: Props) {
  return (
    <main className="gyeol">
      <a className="g-skip" href="#choose">본문으로 바로가기</a>
      <header className="g-nav">
        <a className="g-brand" href="/" aria-label="스터디결 홈"><span className="g-mark" aria-hidden="true">결</span>스터디결<span className="g-beta">BETA</span></a>
        <nav aria-label="주요 메뉴"><a href="#personal">개인을 위한 결</a><a href="#academy">학원을 위한 결</a></nav>
        <button className="g-login" onClick={() => onLogin("student")}>기존 회원 로그인 <ArrowUpRight size={15}/></button>
      </header>

      <section className="g-hero">
        <div className="g-hero-copy"><p className="g-eyebrow"><span/> 나의 배움이 이어지는 곳</p>
          <h1>공부에도,<br/>나만의 <em>결</em>이 있다.</h1>
          <p className="g-lead">혼자 공부하는 오늘부터, 함께 성장하는 교실까지.<br/>나에게 맞는 학습의 시작, 스터디결.</p>
          <a className="g-button" href="#choose">나에게 맞는 스터디결 찾기 <ArrowRight size={18}/></a>
          <p className="g-hero-note">오답 기록에서 시작해, 전 과목 학습 관리로.</p>
        </div>
        <div className="g-art" onPointerMove={tiltNote} onPointerLeave={resetNote} onPointerCancel={resetNote} aria-label="학습 기록 화면의 예시. 실제 학생 데이터가 아닙니다.">
          <div className="g-orbit"/>
          <div className="g-note-motion">
          <div className="g-note"><div className="g-note-top"><span><BookOpen size={17}/> 나의 학습 노트</span><small>화면 예시</small></div><h2>오늘의 배움을<br/>내일의 실력으로.</h2><p>작은 기록이 쌓여, 나만의 결이 됩니다.</p>
            <div className="g-subject"><span className="g-subject-icon">수</span><div><b>수학 · 다시 풀어볼 문제</b><small>틀린 이유를 기록하고 한 번 더</small></div><Check size={18}/></div>
            <div className="g-subject"><span className="g-subject-icon peach">영</span><div><b>영어 · 기억하고 싶은 문장</b><small>나만의 학습 기록으로 차곡차곡</small></div><Check size={18}/></div>
            <div className="g-subject"><span className="g-subject-icon blue">국</span><div><b>국어 · 놓쳤던 개념</b><small>배운 내용을 내 것으로</small></div><Check size={18}/></div>
            <div className="g-note-bottom"><span>MY LEARNING, MY WAY</span><span>스터디결 ↗</span></div>
          </div></div><div className="g-float"><Sparkles size={20}/><span>어제보다 한 결 더.</span></div>
        </div>
      </section>

      <section className="g-choose g-wrap" id="choose"><div className="g-section-head"><p className="g-eyebrow">TWO WAYS, ONE GYEOL</p><h2>어떤 배움을<br className="g-mobile-break"/> 시작하고 싶으세요?</h2><p>공부하는 나에게도, 가르치는 우리에게도 맞는 공간.</p></div>
        <div className="g-paths">
          <a className="g-path g-personal" href="#personal"><span className="g-path-top"><span>FOR LEARNERS</span><BookOpen size={27}/></span><h3>나만의 속도로,<br/>개인을 위한 스터디결</h3><p>흩어진 오답과 공부 기록을 모아<br/>다음에 무엇을 공부할지 선명하게.</p><span className="g-path-foot">개인용 알아보기 <ArrowUpRight size={24}/></span></a>
          <a className="g-path g-academy" href="#academy"><span className="g-path-top"><span>FOR ACADEMIES</span><Building2 size={27}/></span><h3>우리 학원에 맞게,<br/>학원을 위한 스터디결</h3><p>학생의 기록을 수업과 연결해<br/>한 명 한 명을 더 깊이 이해하도록.</p><span className="g-path-foot">학원용 알아보기 <ArrowUpRight size={24}/></span></a>
        </div>
      </section>

      <section className="g-detail g-wrap" id="personal"><div className="g-detail-title"><span className="g-section-icon"><GraduationCap/></span><p className="g-eyebrow">01 / FOR ME</p><h2>남의 진도보다,<br/>나의 이해가 먼저.</h2><p>틀렸던 문제도, 이해한 순간도.<br/>나를 알아가는 공부 기록을 시작하세요.</p><button className="g-button" onClick={() => onLogin("student")}>기존 학생 계정으로 로그인 <ArrowRight size={17}/></button><p className="g-availability">현재는 기존 학원 학생 계정으로 이용할 수 있습니다.<br/>개인 회원가입과 전 과목 맞춤 학습은 준비 중입니다.</p></div>
        <div className="g-feature-list"><article><span>01</span><div><h3>내 오답을 한곳에서</h3><p>교재별 오답과 메모를 확인하고, 다시 공부할 문제를 찾아보세요.</p></div></article><article><span>02</span><div><h3>수업과 복습을 연결</h3><p>내 수업·교재 정보와 저장된 오답노트 PDF 기록을 함께 확인하세요.</p></div></article><article><span>03</span><div><h3>나에게 맞춘 다음 공부 <small>준비 중</small></h3><p>전 과목 학습 기록, 취약 단원 분석, 정답보다 힌트를 주는 AI 튜터로 확장할 예정입니다.</p></div></article></div>
      </section>

      <div className="g-academy-band"><section className="g-detail g-wrap" id="academy"><div className="g-detail-title"><span className="g-section-icon"><Layers3/></span><p className="g-eyebrow">02 / FOR OUR CLASS</p><h2>기록을 살피는 시간을,<br/>학생을 이해하는 시간으로.</h2><p>학생의 오답에서 다음 수업의 실마리를.<br/>선생님과 학생을 잇는 학습 관리 공간입니다.</p><button className="g-button" onClick={() => onLogin("teacher")}>기존 선생님·관리자 로그인 <ArrowRight size={17}/></button><p className="g-availability">현재 연결된 학원의 기존 계정으로 이용할 수 있습니다.<br/>새 학원 등록과 학원별 독립 운영은 준비 중입니다.</p></div><div className="g-feature-list"><article><span>01</span><div><h3>학생과 수업 현황 확인</h3><p>학생 명단과 반·학교·교재 정보를 확인해 수업을 준비하세요.</p></div></article><article><span>02</span><div><h3>오답 제출 기록 함께 보기</h3><p>조회 가능한 학생의 오답과 PDF 기록, 제출 보고서를 한곳에서 살펴보세요.</p></div></article><article><span>03</span><div><h3>우리 학원만의 운영 공간 <small>준비 중</small></h3><p>학원별 데이터 분리와 선생님 초대, 반별 학습 분석을 지원하는 구조로 확장할 예정입니다.</p></div></article></div></section></div>

      <section className="g-faq g-wrap"><div><p className="g-eyebrow">GOOD TO KNOW</p><h2>시작하기 전에.</h2></div><div><details><summary>수학만을 위한 서비스인가요?</summary><p>전 과목 학습 플랫폼을 목표로 합니다. 현재 연결된 서비스는 수학 오답·수업 기록 조회를 중심으로 제공하며, 전 과목 기능은 순차적으로 준비합니다.</p></details><details><summary>지금 개인이나 다른 학원이 가입할 수 있나요?</summary><p>현재는 기존 학원 계정으로 로그인할 수 있습니다. 개인 회원가입과 신규 학원 도입은 아직 제공되지 않습니다.</p></details><details><summary>기존 SG 오답노트 계정을 사용할 수 있나요?</summary><p>네. 기존 학생 계정 또는 선생님·관리자 로그인으로 연결된 학습 기록을 확인할 수 있습니다.</p></details></div></section>
      <footer className="g-footer g-wrap" style={{ flexWrap: "wrap" }}>
        <a className="g-brand" href="/">스터디결</a><p>나만의 공부, 나만의 결.</p><span>개인의 성장부터, 교실의 변화까지.</span>
        <div style={{ flexBasis: "100%", color: "var(--muted)", fontSize: "12px", lineHeight: 1.9 }}>
          <div>대표: 추재현</div>
          <address style={{ fontStyle: "normal" }}>주소: 울산광역시 남구 대학로 72-1 3층</address>
          <p style={{ margin: "12px 0 0" }}>Copyright © 2026 스터디결. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

