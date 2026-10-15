export default function BrandLockup({ compact = false, solo = false, tagline = !solo }: { compact?: boolean; solo?: boolean; tagline?: boolean }) {
  const lockup = <div className={`brand-lockup${compact ? " brand-lockup-compact" : ""}`} aria-label={solo ? "스터디결" : "SG 고등관 × 스터디결"}>
    {!solo && <><img src="/partners/sg.png" alt="SG 고등관" width="309" height="70" /><span className="brand-cross" aria-hidden="true">×</span></>}
    <span className="brand-gyeol"><span className="brand-gyeol-mark" aria-hidden="true">결</span>스터디결</span>
  </div>;
  return tagline ? <div className="workspace-branding">{lockup}<p>울산 최고의 수학학원과 AI 학습 플랫폼이 만나다.</p></div> : lockup;
}
