"use client";

import { useState } from "react";

export default function StudentAttendance({ classes }: { classes: string[] }) {
  const [className, setClassName] = useState(classes[0] || "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function tryCheckIn() {
    if (!navigator.geolocation) { setStatus("이 브라우저에서는 위치 확인을 사용할 수 없습니다."); return; }
    setBusy(true); setStatus("휴대폰 위치를 확인하는 중입니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracy = Math.round(position.coords.accuracy);
        setStatus(code.trim().toUpperCase() === "SGDEMO"
          ? `출석 완료 화면 예시 · 위치 오차 약 ${accuracy}m · 실제 출석은 저장되지 않았습니다.`
          : `선생님 확인 대기 화면 예시 · 위치 오차 약 ${accuracy}m · 5층 코드는 SGDEMO를 입력해보세요.`);
        setBusy(false);
      },
      () => { setStatus("위치 권한이 없어 출석 확인 대기 화면으로 진행합니다. 실제 출석은 저장되지 않았습니다."); setBusy(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return <section className="panel attendance-panel"><h2>📍 출석 체크 <small>데모</small></h2>
    <p className="attendance-notice">체험 화면입니다. 위치를 확인해도 실제 출석 명단이나 데이터베이스에는 기록되지 않습니다.</p>
    <p>출석 장소 예시: 울산 남구 문수로 374, 5층 SG고등관</p>
    <label>수업 반<select value={className} onChange={(event) => setClassName(event.target.value)}>{classes.map((name) => <option key={name}>{name}</option>)}</select></label>
    <label>5층 교실 출석 코드<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" placeholder="데모 코드: SGDEMO" /></label>
    <p>실제 운영에서는 선생님이 교실에 표시한 당일 코드와 GPS를 함께 확인합니다. GPS만으로 5층은 판별할 수 없습니다.</p>
    <button className="primary" type="button" disabled={busy || !className} onClick={tryCheckIn}>{busy ? "위치 확인 중…" : "출석 체크 체험하기"}</button>
    {status && <p role="status" className="workspace-message">{status}</p>}
  </section>;
}

