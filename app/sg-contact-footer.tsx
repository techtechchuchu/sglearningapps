"use client";

export default function SgContactFooter({ onOpenAI }: { onOpenAI?: () => void }) {
  if (onOpenAI) return <footer className="sg-contact-footer" aria-label="스터디결 이용 문의">
    <button type="button" className="sg-contact-ai-only" onClick={onOpenAI}>AI 상담사 결결이</button>
  </footer>;
  return <footer className="sg-contact-footer" aria-label="SG고등관 이용 문의">
    <span>스터디결 이용 중 도움이 필요하신가요?</span>
    <a href="https://open.kakao.com/o/sLgsIMFi" target="_blank" rel="noopener noreferrer">💬 오픈채팅 문의</a>
  </footer>;
}
