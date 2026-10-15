"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type ClassOption = { className: string; teacherName: string; demo?: boolean };
type AttendanceRecord = { id: number; attendance_date: string; class_name: string; teacher_name: string; status: string };
type Stage = "idle" | "progress" | "success" | "failure";

const STATUS: Record<string, string> = { pending: "확인 대기", present: "출석", late: "지각", absent: "결석" };

export default function StudentAttendance({ classes }: { classes: ClassOption[] }) {
  const [selectedKey, setSelectedKey] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestId = useRef(0);
  const chosen = classes.find((item) => `${item.teacherName}\0${item.className}` === selectedKey) || classes[0];

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/attendance", { signal: controller.signal }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "출석 이력을 불러오지 못했습니다.");
      setRecords(data.records || []);
      setHistoryError("");
    }).catch((cause) => { if (!controller.signal.aborted) setHistoryError(cause instanceof Error ? cause.message : "출석 이력을 불러오지 못했습니다."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let completed = false;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        timer = setInterval(() => {
          if (!video.videoWidth || !video.videoHeight || !context) return;
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(image.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
          if (!qr || completed) return;
          try {
            let payload;
            if (qr.data.startsWith("https://studygyeol.vercel.app/#attendance=")) {
              const url = new URL(qr.data);
              payload = { type: "sg-attendance", version: 2, teacherName: "전체 관리자", className: "출석 데모반", qrToken: url.hash.slice("#attendance=".length) };
            } else {
              payload = JSON.parse(qr.data);
            }
            if (payload.type !== "sg-attendance" || ![1, 2].includes(payload.version)) throw new Error("출석용 QR이 아닙니다.");
            if (payload.version === 1) {
              if (!/^\d{6}$/.test(payload.code)) throw new Error("출석용 QR이 아닙니다.");
              const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
              const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
              if (payload.date !== `${part("year")}-${part("month")}-${part("day")}`) throw new Error("오늘 발급된 QR이 아닙니다.");
            } else if (payload.teacherName !== "전체 관리자" || payload.className !== "출석 데모반" || !/^[A-Za-z0-9_-]{32}$/.test(payload.qrToken)) {
              throw new Error("출석 데모반 QR이 아닙니다.");
            }
            const match = classes.find((item) => item.teacherName === payload.teacherName && item.className === payload.className);
            if (!match) throw new Error("내가 등록된 반의 QR이 아닙니다.");
            completed = true;
            setSelectedKey(`${match.teacherName}\0${match.className}`);
            setCode(payload.version === 1 ? payload.code : "");
            setScanError("");
            setScanning(false);
            void checkIn(match, payload.version === 1 ? payload.code : "", payload.version === 2 ? payload.qrToken : "");
          } catch (cause) { setScanError(cause instanceof Error ? cause.message : "QR을 읽지 못했습니다."); }
        }, 250);
      } catch { if (!cancelled) { setScanError("카메라를 열지 못했습니다. 권한을 허용하거나 수동 코드를 입력해주세요."); setScanning(false); } }
    }
    void start();
    return () => { cancelled = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, classes]);

  async function checkIn(target = chosen, enteredCode = code, qrToken = "") {
    if (!target) return;
    if (!qrToken && (target.demo ? enteredCode.trim().toUpperCase() !== "SGDEMO" : !/^\d{6}$/.test(enteredCode.trim()))) {
      setStage("failure"); setResult(target.demo ? "데모 코드는 SGDEMO입니다." : "선생님이 안내한 6자리 출석 코드를 입력해주세요."); return;
    }
    if (!navigator.geolocation) { setStage("failure"); setResult("이 브라우저는 위치 확인을 지원하지 않습니다."); return; }
    const current = ++requestId.current;
    setStage("progress"); setResult("위치 권한을 확인하고 있습니다.");
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (current !== requestId.current) return;
      if (target.demo) {
        setStage("success"); setResult("출석 완료 화면 예시입니다. 데모반은 실제 출석 기록으로 저장되지 않습니다."); return;
      }
      try {
        const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkIn", teacherName: target.teacherName, className: target.className, code: enteredCode.trim(), qrToken, accuracy: Math.round(position.coords.accuracy) }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "출석 요청에 실패했습니다.");
        if (current !== requestId.current) return;
        setStage("success"); setResult(data.message || "출석 요청이 접수되었습니다.");
        const history = await fetch("/api/attendance").then((item) => item.json());
        if (current === requestId.current && history.ok) setRecords(history.records || []);
      } catch (cause) {
        if (current === requestId.current) { setStage("failure"); setResult(cause instanceof Error ? cause.message : "출석 요청에 실패했습니다."); }
      }
    }, (error) => {
      if (current !== requestId.current) return;
      setStage("failure");
      setResult(error.code === 1 ? "위치 권한이 거부되었습니다. 브라우저 위치 권한을 허용한 뒤 다시 시도해주세요." : "현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  useEffect(() => {
    const token = window.location.hash.startsWith("#attendance=") ? window.location.hash.slice("#attendance=".length) : "";
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) { setStage("failure"); setResult("출석용 QR 주소가 올바르지 않습니다."); return; }
    const target = classes.find((item) => item.teacherName === "전체 관리자" && item.className === "출석 데모반");
    if (!target) { setStage("failure"); setResult("출석 데모반에 등록된 학생만 출석할 수 있습니다."); return; }
    setSelectedKey(`${target.teacherName}\0${target.className}`);
    void checkIn(target, "", token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeDialog() { requestId.current += 1; setStage("idle"); setResult(""); }

  return <section className="panel attendance-panel">
    <div className="attendance-heading"><div><span className="attendance-eyebrow">전자출결</span><h2>출석 체크</h2></div><span className="attendance-demo-tag">{chosen?.demo ? "데모반" : "선생님 확인형"}</span></div>
    <p className="attendance-notice">출석 데모반의 교실 고정 QR을 스캔하면 출석이 바로 기록됩니다. 다른 반은 선생님 확인 대기로 접수됩니다. GPS 권한은 확인하지만 5층 위치를 자동 판별하지는 않습니다.</p>
    <article className="attendance-course"><span>출석할 수업</span><strong>{chosen?.className || "등록된 반이 없습니다"}</strong><small>{chosen?.teacherName || "담당 선생님 미지정"} · 울산 남구 문수로 374, 5층 SG고등관</small></article>
    {classes.length > 1 && <label>수업 선택<select value={`${chosen.teacherName}\0${chosen.className}`} onChange={(event) => { setSelectedKey(event.target.value); setCode(""); }}>{classes.map((item) => <option value={`${item.teacherName}\0${item.className}`} key={`${item.teacherName}-${item.className}`}>{item.className} · {item.teacherName}</option>)}</select></label>}
    <button className="attendance-scan-button" type="button" disabled={!chosen || stage === "progress"} onClick={() => { setScanError(""); setScanning((value) => !value); }}>{scanning ? "카메라 닫기" : "카메라로 QR 스캔"}</button>
    {scanning && <div className="attendance-camera"><video ref={videoRef} playsInline muted aria-label="출석 QR 스캔 카메라" /><p>교실에 붙인 출석 QR을 카메라에 맞춰주세요.</p></div>}
    {scanError && <p className="workspace-message" role="alert">{scanError}</p>}
    <label>교실 출석 코드<input inputMode={chosen?.demo ? "text" : "numeric"} autoCapitalize="characters" maxLength={chosen?.demo ? 8 : 6} value={code} onChange={(event) => setCode(chosen?.demo ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ""))} placeholder={chosen?.demo ? "데모 코드 SGDEMO" : "선생님이 안내한 6자리 코드"} /></label>
    <button className="primary attendance-check-button" type="button" disabled={!chosen || stage === "progress"} onClick={() => void checkIn()}>출석 체크</button>
    <p className="attendance-help">위치 정보의 좌표는 저장하지 않습니다. 출석 데모반의 QR은 출석 이력에 바로 기록됩니다.</p>

    <section className="attendance-history" aria-label="내 출석 이력"><h3>내 출석 이력</h3>{historyError ? <p role="alert">{historyError}</p> : records.length ? <div className="attendance-history-list">{records.map((record) => <div className="attendance-history-row" key={record.id}><div><strong>{record.class_name}</strong><small>{record.attendance_date} · {record.teacher_name}</small></div><span className={`attendance-status attendance-status-${record.status}`}>{STATUS[record.status] || record.status}</span></div>)}</div> : <p>아직 저장된 출석 이력이 없습니다.</p>}</section>

    {stage !== "idle" && <div className="attendance-modal-backdrop" role="presentation"><div className="attendance-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-modal-title"><div className={`attendance-modal-icon attendance-modal-${stage}`} aria-hidden="true">{stage === "progress" ? "···" : stage === "success" ? "✓" : "!"}</div><h3 id="attendance-modal-title">{stage === "progress" ? "출석 체크 진행 중이에요" : stage === "success" ? "출석 요청 완료" : "출석 체크 실패"}</h3><p role="status">{result}</p><button type="button" onClick={closeDialog}>{stage === "progress" ? "중지" : "확인"}</button></div></div>}
  </section>;
}

