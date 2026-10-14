export default function BrandLockup({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`} aria-label="SG 고등관 × 스터디결">
    <img src="/partners/sg.png" alt="SG 고등관" width="309" height="70" />
    <span className="brand-cross" aria-hidden="true">×</span>
    <span className="brand-gyeol"><span className="brand-gyeol-mark" aria-hidden="true">결</span>스터디결</span>
  </div>;
}
