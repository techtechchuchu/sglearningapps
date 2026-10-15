import { ArrowUpRight, ArrowRight, BookOpen, GraduationCap, Layers3, Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./landing-motion.css";
import LearningScene from "./learning-scene";
import "./partners.css";
import "./company.css";

type Props = { onLogin: (mode: "student" | "teacher") => void };

export default function Landing({ onLogin }: Props) {
  const landingRef = useRef<HTMLElement>(null);
  const [companyTab, setCompanyTab] = useState<"company" | "ceo">("company");
  useEffect(() => {
    const root = landingRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const elements = root.querySelectorAll(".g-section-head, .g-path, .g-detail-title, .g-feature-list article, .g-faq, .g-partner-card, .g-company-card");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("g-revealed");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    elements.forEach(element => observer.observe(element));
    return () => {
      observer.disconnect();
      elements.forEach(element => element.classList.remove("g-revealed"));
    };
  }, []);
  return (
    <main className="gyeol" ref={landingRef}>
      <a className="g-skip" href="#choose">본문으로 바로가기</a>
      <header className="g-nav">
        <a className="g-brand" href="/" aria-label="스터디결 홈"><span className="g-mark" aria-hidden="true">결</span>스터디결<span className="g-beta">BETA</span></a>
        <nav aria-label="주요 메뉴"><a href="#personal">개인을 위한 결</a><a href="#academy">학원을 위한 결</a><a href="#company">회사소개</a></nav>
        <button className="g-login" onClick={() => onLogin("student")}>지금 시작하기 <ArrowUpRight size={15}/></button>
      </header>

      <LearningScene />
      <section className="g-company g-wrap" id="company" aria-labelledby="company-title">
        <div className="g-section-head"><p className="g-eyebrow">ABOUT STUDY GYEOL</p><h2 id="company-title">스터디결을 소개합니다.</h2><p>배움의 기록이 다음 성장을 이어 주도록.</p></div>
        <div className="g-company-tabs" role="tablist" aria-label="회사소개 메뉴">
          <button type="button" role="tab" id="company-tab" aria-controls="company-panel" aria-selected={companyTab === "company"} onClick={() => setCompanyTab("company")}>회사소개</button>
          <button type="button" role="tab" id="ceo-tab" aria-controls="ceo-panel" aria-selected={companyTab === "ceo"} onClick={() => setCompanyTab("ceo")}>대표소개</button>
        </div>
        {companyTab === "company" ? (
          <div className="g-company-card" id="company-panel" role="tabpanel" aria-labelledby="company-tab">
            <div className="g-company-copy"><p className="g-eyebrow">OUR STORY</p><h3>흩어진 학습 기록을<br/>하나의 흐름으로.</h3><p>스터디결은 학생의 오답과 공부 기록을 모으고, 선생님이 학생의 배움을 더 깊이 살필 수 있도록 돕는 학습 관리 서비스입니다.</p><p>교육 현장의 반복 업무에서 출발해, 학생에게는 스스로 돌아볼 수 있는 기록을, 선생님에게는 다음 수업을 준비할 실마리를 전합니다.</p><a href="#choose" className="g-company-link">서비스 살펴보기 <ArrowUpRight size={17}/></a></div>
            <div className="g-company-values" aria-label="스터디결의 방향"><span>기록</span><span>이해</span><span>성장</span></div>
          </div>
        ) : (
          <div className="g-company-card g-ceo-card" id="ceo-panel" role="tabpanel" aria-labelledby="ceo-tab">
            <div className="g-ceo-photo"><img src="/ceo/choo-jaehyun.png" alt="스터디결 대표 추재현" width="1180" height="1333" loading="lazy"/></div>
            <div className="g-company-copy"><p className="g-eyebrow">FOUNDER & CEO</p><h3>추재현</h3><strong>현장의 불편을 서비스로 바꿉니다.</strong><p>울산대학교 ICT융합학부에서 산업ICT공학과 컴퓨터공학을 전공할 예정입니다. 교육 현장에서 발견한 문제를 서비스와 프로젝트로 구현하고 있습니다.</p><p>SG 오답노트에서 시작한 학습 관리의 경험을 스터디결로 이어가며, 배우고 만들고 기록하는 일을 계속하고 있습니다.</p><a href="https://jaehyun-portfolio.k88yjdr4bb.chatgpt.site/" className="g-company-link" target="_blank" rel="noopener noreferrer">추재현 포트폴리오 보기 <ArrowUpRight size={17}/></a></div>
          </div>
        )}
      </section>

      <div className="g-company-contact g-wrap" aria-label="인재영입 및 협업 문의">
        <a href="mailto:cjh1645@naver.com?subject=%5B%EC%8A%A4%ED%84%B0%EB%94%94%EA%B2%B0%5D%20%EC%9D%B8%EC%9E%AC%EC%98%81%EC%9E%85%20%EB%AC%B8%EC%9D%98"><span>JOIN US</span><strong>인재영입</strong><p>함께 교육의 다음 장면을 만들어 갈 분을 기다립니다.</p><ArrowUpRight size={20}/></a>
        <a href="mailto:cjh1645@naver.com?subject=%5B%EC%8A%A4%ED%84%B0%EB%94%94%EA%B2%B0%5D%20%ED%98%91%EC%97%85%20%EB%AC%B8%EC%9D%98"><span>PARTNERSHIP</span><strong>협업문의</strong><p>교육 현장의 문제를 함께 해결할 제안을 들려주세요.</p><ArrowUpRight size={20}/></a>
      </div>

      <section className="g-partners g-wrap" aria-labelledby="partners-title" id="partners">
        <div className="g-section-head"><p className="g-eyebrow">LEARNING, TOGETHER</p><h2 id="partners-title">지금, 스터디결과 함께하고 있어요.</h2><p>현대해상 이주배경 청소년 멘토링과 SG 고등관에서 스터디결을 이용하고 있습니다.</p></div>
        <div className="g-partner-grid">
          <article className="g-partner-card"><div className="g-partner-inner"><span className="g-partner-status"><i aria-hidden="true"/>이용 중</span><div className="g-partner-logo g-partner-collab"><img src="/partners/hyundai.png" alt="현대해상" width="319" height="102" loading="lazy"/><span aria-hidden="true">×</span><img src="/partners/jump.png" alt="JUMP" width="293" height="107" loading="lazy"/></div><h3>현대해상 이주배경 청소년 멘토링</h3><p>현대해상 · JUMP와 함께하는 멘토링 현장</p></div></article>
          <article className="g-partner-card"><div className="g-partner-inner"><span className="g-partner-status"><i aria-hidden="true"/>이용 중</span><div className="g-partner-logo"><img src="/partners/sg.png" alt="SG 고등관" width="309" height="70" loading="lazy"/></div><h3>SG 고등관</h3><p>학원 수업 현장에서 함께하는 스터디결</p></div></article>
        </div>
      </section>

      <section className="g-choose g-wrap" id="choose"><div className="g-section-head"><p className="g-eyebrow">TWO WAYS, ONE GYEOL</p><h2>어떤 배움을<br className="g-mobile-break"/> 시작하고 싶으세요?</h2><p>공부하는 나에게도, 가르치는 우리에게도 맞는 공간.</p></div>
        <div className="g-paths">
          <a className="g-path g-personal" href="#personal"><span className="g-path-top"><span>FOR LEARNERS</span><BookOpen size={27}/></span><h3>나만의 속도로,<br/>개인을 위한 스터디결</h3><p>흩어진 오답과 공부 기록을 모아<br/>다음에 무엇을 공부할지 선명하게.</p><span className="g-path-foot">개인용 알아보기 <ArrowUpRight size={24}/></span></a>
          <a className="g-path g-academy" href="#academy"><span className="g-path-top"><span>FOR ACADEMIES</span><Building2 size={27}/></span><h3>우리 학원에 맞게,<br/>학원을 위한 스터디결</h3><p>학생의 기록을 수업과 연결해<br/>한 명 한 명을 더 깊이 이해하도록.</p><span className="g-path-foot">학원용 알아보기 <ArrowUpRight size={24}/></span></a>
        </div>
      </section>

      <section className="g-detail g-wrap" id="personal"><div className="g-detail-title"><span className="g-section-icon"><GraduationCap/></span><p className="g-eyebrow">01 / FOR ME</p><h2>남의 진도보다,<br/>나의 이해가 먼저.</h2><p>틀렸던 문제도, 이해한 순간도.<br/>나를 알아가는 공부 기록을 시작하세요.</p><button className="g-button" onClick={() => onLogin("student")}>학생으로 지금 시작하기 <ArrowRight size={17}/></button><p className="g-availability">현재는 기존 학원 학생 계정으로 이용할 수 있습니다.<br/>개인 회원가입과 전 과목 맞춤 학습은 준비 중입니다.</p></div>
        <div className="g-feature-list"><article><span>01</span><div><h3>내 오답을 한곳에서</h3><p>교재별 오답과 메모를 확인하고, 다시 공부할 문제를 찾아보세요.</p></div></article><article><span>02</span><div><h3>수업과 복습을 연결</h3><p>내 수업·교재 정보와 저장된 오답노트 PDF 기록을 함께 확인하세요.</p></div></article><article><span>03</span><div><h3>나에게 맞춘 다음 공부 <small>준비 중</small></h3><p>전 과목 학습 기록, 취약 단원 분석, 정답보다 힌트를 주는 AI 튜터로 확장할 예정입니다.</p></div></article></div>
      </section>

      <div className="g-academy-band"><section className="g-detail g-wrap" id="academy"><div className="g-detail-title"><span className="g-section-icon"><Layers3/></span><p className="g-eyebrow">02 / FOR OUR CLASS</p><h2>기록을 살피는 시간을,<br/>학생을 이해하는 시간으로.</h2><p>학생의 오답에서 다음 수업의 실마리를.<br/>선생님과 학생을 잇는 학습 관리 공간입니다.</p><button className="g-button" onClick={() => onLogin("teacher")}>선생님·관리자로 지금 시작하기 <ArrowRight size={17}/></button><p className="g-availability">현재 연결된 학원의 기존 계정으로 이용할 수 있습니다.<br/>새 학원 등록과 학원별 독립 운영은 준비 중입니다.</p></div><div className="g-feature-list"><article><span>01</span><div><h3>학생과 수업 현황 확인</h3><p>학생 명단과 반·학교·교재 정보를 확인해 수업을 준비하세요.</p></div></article><article><span>02</span><div><h3>오답 제출 기록 함께 보기</h3><p>조회 가능한 학생의 오답과 PDF 기록, 제출 보고서를 한곳에서 살펴보세요.</p></div></article><article><span>03</span><div><h3>우리 학원만의 운영 공간 <small>준비 중</small></h3><p>학원별 데이터 분리와 선생님 초대, 반별 학습 분석을 지원하는 구조로 확장할 예정입니다.</p></div></article></div></section></div>

      <section className="g-faq g-wrap"><div><p className="g-eyebrow">GOOD TO KNOW</p><h2>시작하기 전에.</h2></div><div><details><summary>수학만을 위한 서비스인가요?</summary><p>전 과목 학습 플랫폼을 목표로 합니다. 현재 연결된 서비스는 수학 오답·수업 기록 조회를 중심으로 제공하며, 전 과목 기능은 순차적으로 준비합니다.</p></details><details><summary>지금 개인이나 다른 학원이 가입할 수 있나요?</summary><p>현재는 기존 학원 계정으로 로그인할 수 있습니다. 개인 회원가입과 신규 학원 도입은 아직 제공되지 않습니다.</p></details><details><summary>기존 SG 오답노트 계정을 사용할 수 있나요?</summary><p>네. 기존 학생 계정 또는 선생님·관리자 로그인으로 연결된 학습 기록을 확인할 수 있습니다.</p></details></div></section>
      <footer className="g-business-footer">
        <div className="g-wrap">
          <div className="g-footer-heading">
            <div><a className="g-brand" href="/"><span className="g-mark" aria-hidden="true">결</span>스터디결</a><p>나만의 공부, 나만의 결.</p></div>
            <nav aria-label="하단 서비스 안내"><a href="#choose">서비스 소개</a><a href="#personal">개인용 안내</a><a href="#academy">학원용 안내</a><a href="mailto:cjh1645@gmail.com">고객 문의</a><button onClick={() => onLogin("student")}>로그인</button></nav>
          </div>
          <div className="g-footer-services"><strong>배움의 시작부터, 성장의 기록까지.</strong><div><a href="#personal">개인 학습 기록</a><a href="#personal">오답노트</a><a href="#academy">학생·수업 관리</a><a href="#academy">학원 운영</a></div></div>
          <div className="g-business-details">
            <p>상호: 스터디결 <span aria-hidden="true">·</span> 대표: 추재현 <span aria-hidden="true">·</span> 업태: 정보통신업</p>
            <address>주소: 울산광역시 남구 대학로 72-1 3층</address>
            <p>호스팅 서비스 제공: Vercel</p>
            <p>고객 문의: <a href="mailto:cjh1645@gmail.com">cjh1645@gmail.com</a></p>
          </div>
          <nav aria-label="서비스 정책" style={{ display: "flex", flexWrap: "wrap", gap: "10px 20px", margin: "20px 0" }}><a href="/terms">이용약관</a><a href="/privacy">개인정보 처리방침</a><a href="/content-policy">자체교재·PDF 이용 및 보관 원칙</a></nav>
          <p className="g-copyright">Copyright © 2026 스터디결. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
