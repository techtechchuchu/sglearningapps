export default function DemoExplanationMedia() {
  return <div className="problem-demo-media">
    <p className="problem-demo-disclaimer">화면 예시 · 실제 영상과 풀이 자료는 아직 등록되지 않았습니다.</p>
    <div className="problem-video problem-video-demo" role="img" aria-label="해설 영상이 등록됐을 때의 화면 예시. 실제로 재생되는 영상은 아닙니다.">
      <svg viewBox="0 0 800 450" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <rect width="800" height="450" fill="#40584b" />
        <path d="M0 38H800M0 415H800" stroke="#8aa496" opacity=".25" strokeWidth="2" />
        <path d="M78 370H568M193 425V54" stroke="#d5eadc" strokeWidth="3" opacity=".75" />
        <path d="M143 386L467 76M126 384L584 260" stroke="#c5e7d6" strokeWidth="4" opacity=".8" />
        <circle cx="314" cy="232" r="108" fill="none" stroke="#c4d9e9" strokeWidth="5" />
        <text x="470" y="92" fill="#e6f1e8" fontSize="31" fontFamily="serif">y = 2x</text>
        <text x="540" y="257" fill="#e6f1e8" fontSize="30" fontFamily="serif">y = kx</text>
        <text x="260" y="217" fill="#e6f1e8" fontSize="24" fontFamily="serif">(a, a)</text>
      </svg>
      <span className="problem-demo-play" aria-hidden="true">▶</span>
      <div className="problem-demo-video-title">9번 풀이 영상 예시</div>
      <div className="problem-demo-controls"><span>▶ &nbsp; 0:00 / 5:56</span><span>◖)) &nbsp; ⛶</span><i /></div>
    </div>
    <div className="problem-demo-solution" role="img" aria-label="풀이 이미지가 등록됐을 때의 예시. 원의 중심과 직선 사이 거리를 이용해 상수 a를 구하는 과정입니다.">
      <div><strong>9번 풀이 이미지 예시</strong><p>원 C: (x−a)² + (y−a)² = 10</p><p>중심 (a, a)에서 직선 y = 2x까지의 거리는 √5</p></div>
      <div className="problem-demo-math"><span>│2a − a│ / √5 = √5</span><span>∴ a = 5</span><span>직선 y = kx가 원 C에 접할 때</span><span>│5k − 5│ / √(k² + 1) = √10</span></div>
    </div>
  </div>;
}

