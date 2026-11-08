"use client";

export default function SgContactFooter({ onOpenAI }: { onOpenAI?: () => void }) {
  return <footer className="sg-contact-footer" aria-label="SG고등관 이용 문의">
    <span>스터디결 이용 중 도움이 필요하신가요?</span>
    <div className="sg-contact-actions">{onOpenAI && <button type="button" onClick={onOpenAI}>AI 상담사 결결이</button>}<a href="https://open.kakao.com/o/sLgsIMFi" target="_blank" rel="noopener noreferrer">💬 오픈채팅 문의</a></div>
  </footer>;
}
