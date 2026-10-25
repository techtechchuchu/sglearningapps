"use client";

import { useEffect, useRef, useState } from "react";

type Segment = { at: number; text: string };
type Note = { id: string; course_id: string; title: string; transcript: Segment[]; summary: string; updated_at: string };
type Course = { id: string; title: string };
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function clock(seconds: number) {
  const n = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

function PaymentMethodIcon({ kind }: { kind: "toss" | "kakao" | "card" }) {
  return <span className={`university-payment-icon university-payment-icon--${kind}`} aria-hidden="true">
    {kind === "toss" ? <svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V18H6.5A2.5 2.5 0 0 1 4 15.5v-8Z" stroke="currentColor" strokeWidth="1.8"/><path d="M4 9h16M15 13.5h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> :
      kind === "kakao" ? <svg viewBox="0 0 24 24" fill="none"><path d="M12 4c5 0 9 2.8 9 6.4 0 3.7-4 6.6-9 6.6-.6 0-1.3 0-1.9-.1L6 20l.8-4.3C4.4 14.6 3 12.7 3 10.4 3 6.8 7 4 12 4Z" fill="currentColor"/></svg> :
      <svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M3 10h18M7 15.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
  </span>;
}

export default function UniversityLectureNotes({ courses }: { courses: Course[] }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [id, setId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [summary, setSummary] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognizer = useRef<Recognition | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const started = useRef(0);
  const active = useRef(false);
  const seen = useRef<Set<number>>(new Set());
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrl = useRef("");
  const titleInput = useRef<HTMLInputElement | null>(null);

  async function load() {
    const response = await fetch("/api/university/lecture-notes", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "노트를 불러오지 못했습니다.");
    setNotes(result.notes || []);
  }

  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
    void fetch("/api/university/lecture-notes/summarize", { cache: "no-store" }).then((response) => response.json()).then((result) => setAiAvailable(result.enabled === true)).catch(() => {});
    return () => {
      active.current = false;
      recognizer.current?.stop();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (interval.current) clearInterval(interval.current);
      if (restart.current) clearTimeout(restart.current);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  useEffect(() => { if (!courseId && courses[0]) setCourseId(courses[0].id); }, [courseId, courses]);

  function clearAudio() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
    setAudioUrl("");
  }

  function newNote() {
    if (recording) return;
    setId(""); setCourseId(courses[0]?.id || ""); setTitle(""); setSegments([]); setSummary("");
    setMessage(courses.length ? "새 노트입니다. 강의 제목과 내용을 입력한 뒤 저장하거나 AI 요약을 눌러주세요." : "새 노트를 만들려면 먼저 과목을 추가해주세요.");
    clearAudio();
    requestAnimationFrame(() => titleInput.current?.focus());
  }

  function openNote(note: Note) {
    if (recording) return;
    setId(note.id); setCourseId(note.course_id); setTitle(note.title); setSegments(note.transcript || []); setSummary(note.summary || ""); setMessage(""); clearAudio();
  }

  function stopRecording() {
    if (!active.current) return;
    active.current = false;
    if (restart.current) clearTimeout(restart.current);
    if (interval.current) clearInterval(interval.current);
    recognizer.current?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    setRecording(false);
    setMessage("녹음이 끝났습니다. 전사 문장을 확인하고 음성 파일을 다운로드한 뒤 노트를 저장하세요.");
  }

  async function startRecording() {
    setMessage("");
    if (!courseId) { setMessage("먼저 과목을 선택해주세요."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setMessage("이 브라우저에서는 녹음을 지원하지 않습니다."); return; }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      chunks.current = [];
      clearAudio();
      const format = ["audio/webm;codecs=opus", "audio/mp4"].find((value) => MediaRecorder.isTypeSupported(value));
      const media = new MediaRecorder(mic, { ...(format ? { mimeType: format } : {}), audioBitsPerSecond: 64000 });
      recorder.current = media;
      media.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      media.onstop = () => {
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        if (blob.size) { const url = URL.createObjectURL(blob); objectUrl.current = url; setAudioUrl(url); }
      };
      media.start();
      active.current = true;
      started.current = Date.now();
      seen.current = new Set();
      setElapsed(0);
      setRecording(true);
      interval.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - started.current) / 1000);
        setElapsed(seconds);
        if (seconds >= 60 * 60) stopRecording();
      }, 1000);

      const browser = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
      const SpeechRecognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setMessage("녹음 중입니다. 이 브라우저는 자동 받아쓰기를 지원하지 않아, 종료 후 전사를 직접 입력해야 합니다.");
        return;
      }
      const speech = new SpeechRecognition();
      recognizer.current = speech;
      speech.lang = "ko-KR"; speech.continuous = true; speech.interimResults = false;
      speech.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          if (!result.isFinal || seen.current.has(index)) continue;
          seen.current.add(index);
          const text = result[0].transcript.trim();
          if (text) setSegments((old) => [...old, { at: Math.max(0, Math.floor((Date.now() - started.current) / 1000)), text }]);
        }
      };
      speech.onerror = (event) => {
        if (["not-allowed", "service-not-allowed", "network", "audio-capture"].includes(event.error)) {
          setMessage("브라우저 받아쓰기가 중지됐습니다. 녹음은 계속되므로 종료 후 직접 입력할 수 있습니다.");
          speech.onend = null;
        }
      };
      speech.onend = () => {
        if (!active.current) return;
        seen.current = new Set();
        restart.current = setTimeout(() => { try { speech.start(); } catch { setMessage("받아쓰기가 중단됐습니다. 녹음은 계속되므로 종료 후 직접 입력할 수 있습니다."); } }, 300);
      };
      try { speech.start(); } catch { setMessage("자동 받아쓰기를 시작하지 못했습니다. 녹음 후 직접 입력할 수 있습니다."); }
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      setMessage("마이크 사용을 허용한 뒤 다시 시도해주세요.");
    }
  }

  async function saveNote() {
    if (!courseId || !title.trim()) { setMessage("과목과 노트 제목을 입력해주세요."); return; }
    if (recording) { setMessage("녹음을 종료한 뒤 저장해주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/university/lecture-notes", {
        method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, courseId, title, transcript: segments, summary }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "저장하지 못했습니다.");
      if (!id) setId(result.id);
      await load();
      setMessage("노트를 저장했습니다. 음성 원본은 서버에 저장되지 않으니 필요하면 별도로 다운로드하세요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function deleteNote() {
    if (!id || recording || !window.confirm("이 강의 노트와 전사 내용을 삭제할까요?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/university/lecture-notes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "삭제하지 못했습니다.");
      newNote(); await load(); setMessage("노트를 삭제했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function summarizeNote() {
    if (recording || summarizing || busy) return;
    if (!aiAvailable) { setMessage("AI 요약이 아직 활성화되지 않았습니다. 잠시 후 다시 확인해주세요."); return; }
    if (!courseId || !title.trim()) { setMessage("AI 요약 전에 과목과 강의 제목을 입력해주세요."); titleInput.current?.focus(); return; }
    if (segments.map((item) => item.text).join("\n").trim().length < 50) { setMessage("AI 요약을 하려면 받아쓴 내용을 50자 이상 입력해주세요."); return; }
    setSummarizing(true); setMessage("");
    try {
      const saved = await fetch("/api/university/lecture-notes", {
        method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, courseId, title, transcript: segments, summary }),
      });
      const savedResult = await saved.json();
      if (!saved.ok) throw new Error(savedResult.message || "노트를 저장하지 못했습니다.");
      const noteId = id || savedResult.id;
      if (!noteId) throw new Error("저장된 노트를 확인하지 못했습니다.");
      if (!id) setId(noteId);
      await load();
      const response = await fetch("/api/university/lecture-notes/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: noteId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "요약하지 못했습니다.");
      setSummary(result.summary);
      setMessage("AI 요약 초안을 만들었습니다. 내용을 확인하고 노트 저장을 눌러주세요.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "요약하지 못했습니다."); }
    finally { setSummarizing(false); }
  }

  function attachAudio(file?: File) {
    if (!file) return;
    clearAudio();
    const url = URL.createObjectURL(file); objectUrl.current = url; setAudioUrl(url);
  }

  return <section className="panel university-lecture">
    <div className="university-section-heading"><div><span className="university-eyebrow">강의 기록</span><h2>내 강의 노트</h2><p>녹음하면서 받아쓰고, 원문 위치를 확인해 과목별로 정리하세요.</p></div><button type="button" className="ghost" onClick={newNote} disabled={recording}>+ 새 노트</button></div>
    <p className="university-lecture-caution">브라우저 자동 받아쓰기의 정확도와 지원 여부는 기기마다 다르며, 음성이 브라우저 제공자의 인식 서비스로 전송될 수 있습니다. 중요한 수식·전문용어는 원본과 비교하고, 수업의 녹음 허용 여부도 확인하세요.</p>
    <div className="university-lecture-plan" aria-label="AI 강의 요약 이용권 안내">
      <div><span className="university-eyebrow">결제 준비 중</span><h3>AI 강의 요약 이용권</h3><p>출시 예정: 첫 이용부터 3일 무료 체험 후, 30일 이용권 9,900원. 자동 결제는 하지 않습니다.</p></div>
      <div className="university-lecture-payment-methods" aria-label="준비 중인 결제수단">
        <button type="button" disabled><PaymentMethodIcon kind="toss" />토스페이 결제</button>
        <button type="button" disabled><PaymentMethodIcon kind="kakao" />카카오페이 결제</button>
        <button type="button" disabled><PaymentMethodIcon kind="card" />신용카드 결제</button>
      </div>
      <small>현재 결제하거나 무료 체험을 시작할 수 없습니다. 결제 연동 및 서비스 점검 후 버튼이 활성화됩니다.</small>
    </div>
    <div className="university-lecture-grid"><aside aria-label="저장된 강의 노트"><h3>저장된 노트</h3>{notes.length ? notes.map((note) => <button type="button" key={note.id} className={note.id === id ? "selected" : ""} disabled={recording} onClick={() => openNote(note)}><strong>{note.title}</strong><small>{courses.find((course) => course.id === note.course_id)?.title || "과목"} · {new Date(note.updated_at).toLocaleDateString("ko-KR")}</small></button>) : <p>아직 저장된 노트가 없습니다.</p>}</aside>
      <div className="university-lecture-editor"><div className="university-lecture-fields"><label>과목<select value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={recording || Boolean(id)}><option value="">과목 선택</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label><label>강의 제목<input ref={titleInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 미적분학2 · 4주차 강의" maxLength={120} disabled={recording} /></label></div>
        <div className="university-lecture-recorder"><div><strong>{recording ? `● 녹음 중 ${clock(elapsed)}` : "녹음 또는 원본 파일 연결"}</strong><small>최대 60분 · 녹음 파일은 기기에만 남습니다.</small></div>{recording ? <button type="button" onClick={stopRecording}>녹음 종료</button> : <button type="button" onClick={() => void startRecording()} disabled={!courseId}>녹음 시작</button>}</div>
        {audioUrl && <div className="university-lecture-playback"><audio ref={audio} controls src={audioUrl} /><a href={audioUrl} download={`${title.trim() || "강의녹음"}.${audioUrl && recorder.current?.mimeType.includes("mp4") ? "m4a" : "webm"}`}>원본 음성 다운로드</a></div>}
        {!recording && <label className="university-lecture-attach">이전에 저장한 음성 파일을 다시 연결하기<input type="file" accept="audio/*" onChange={(event) => attachAudio(event.target.files?.[0])} /></label>}
        <div className="university-lecture-transcript"><div className="university-section-heading"><div><h3>받아쓴 내용</h3><p>시간을 누르면 연결한 음성의 해당 위치로 이동합니다. 받아쓰기 시각은 대략적인 위치입니다.</p></div><button type="button" className="ghost" disabled={recording} onClick={() => setSegments((old) => [...old, { at: elapsed, text: "" }])}>+ 문장 추가</button></div>{segments.map((segment, index) => <div className="university-lecture-line" key={index}><button type="button" disabled={!audioUrl} onClick={() => { if (audio.current) { audio.current.currentTime = segment.at; void audio.current.play(); } }}>{clock(segment.at)}</button><textarea aria-label={`${index + 1}번째 전사 문장`} value={segment.text} onChange={(event) => setSegments((old) => old.map((item, position) => position === index ? { ...item, text: event.target.value } : item))} maxLength={500} /><button type="button" className="ghost" aria-label={`${index + 1}번째 문장 삭제`} onClick={() => setSegments((old) => old.filter((_, position) => position !== index))}>×</button></div>)}{!segments.length && <p>녹음하면서 인식된 문장이 여기에 쌓입니다. 인식이 안 되면 직접 입력할 수도 있어요.</p>}</div>
        <label className="university-lecture-summary">내 정리 노트<textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="핵심 개념, 시험에 나올 부분, 이해하지 못한 점을 정리하세요." maxLength={12000} /></label>
        <div className="university-lecture-ai-note"><button type="button" className="ghost" onClick={() => void summarizeNote()} disabled={!aiAvailable || recording || summarizing || busy}>{summarizing ? "요약 중..." : "AI로 초안 요약"}</button><span>{aiAvailable ? "강의 제목과 받아쓴 내용을 50자 이상 입력하면 노트를 먼저 저장한 뒤 AI 요약을 시작합니다. 입력한 내용은 외부 AI 서비스로 전송되므로 개인정보가 없는지 확인하세요. 결과를 확인하고 다시 저장해야 합니다." : "AI 요약 활성화 대기 중입니다. 지금은 전사 내용을 직접 정리·저장할 수 있습니다."}</span></div>
        {message && <p className="workspace-message" role="status">{message}</p>}<div className="university-lecture-actions"><button type="button" className="primary" onClick={() => void saveNote()} disabled={busy || recording || !courseId || !title.trim()}>{busy ? "처리 중..." : "노트 저장"}</button>{id && <button type="button" className="ghost" onClick={() => void deleteNote()} disabled={busy || recording}>노트 삭제</button>}</div>
      </div></div>
  </section>;
}

