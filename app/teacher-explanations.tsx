"use client";

import { FormEvent, useEffect, useState } from "react";
import { examOptions } from "../lib/wrong-answers";
import { explanationKey, type Explanation } from "../lib/problem-explanations";

type Row = Record<string, any>;

export default function TeacherExplanations({ books, schoolExams }: { books: string[]; schoolExams: Row[] }) {
  const [kind, setKind] = useState<"xpattern" | "school">("xpattern");
  const [book, setBook] = useState("");
  const [school, setSchool] = useState("");
  const [examId, setExamId] = useState("");
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saved, setSaved] = useState<Explanation[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const xBooks = books.filter((item) => examOptions(item).length > 0);
  const effectiveBook = xBooks.includes(book) ? book : xBooks[0] || "";
  const options = kind === "xpattern" ? examOptions(effectiveBook) : schoolExams.map((exam) => ({ id: String(exam.id), school: String(exam.school_name || ""), label: String(exam.display_name || `${exam.exam_year} ${exam.school_name} ${exam.exam_type}`), max: Number(exam.question_count) || 20 }));
  const schools = [...new Set(options.map((item) => item.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const effectiveSchool = schools.includes(school) ? school : schools[0] || "";
  const schoolOptions = options.filter((item) => item.school === effectiveSchool);
  const effectiveExamId = schoolOptions.some((item) => item.id === examId) ? examId : schoolOptions[0]?.id || "";
  const max = Math.min(Number(schoolOptions.find((item) => item.id === effectiveExamId)?.max) || 0, 200);
  const safeNumber = Number.isSafeInteger(number) && number >= 1 && number <= max ? number : 1;
  const existing = effectiveExamId ? saved.find((item) => item.content_key === explanationKey(kind, effectiveExamId, safeNumber, effectiveBook)) : null;

  useEffect(() => {
    setSaved([]); setMessage("");
    if (!effectiveExamId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ kind, book: effectiveBook, examId: effectiveExamId });
    void fetch(`/api/problem-explanations?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "조회 실패"); return result; })
      .then((result) => { setSaved(result.explanations || []); if (!result.available) setMessage("해설 자료 저장 공간이 아직 설치되지 않았습니다."); })
      .catch((error) => { if (error.name !== "AbortError") setMessage(error.message || "해설 조회 실패"); });
    return () => controller.abort();
  }, [kind, effectiveBook, effectiveExamId]);

  useEffect(() => {
    setTitle(existing?.title || "");
    setYoutubeUrl(existing?.youtube_video_id ? `https://www.youtube.com/watch?v=${existing.youtube_video_id}` : "");
    setImageUrl(existing?.image_url || "");
  }, [existing?.content_key, existing?.title, existing?.youtube_video_id, existing?.image_url, safeNumber]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new Error(`문제번호는 1~${max}번입니다.`);
      const response = await fetch("/api/problem-explanations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, book: effectiveBook, examId: effectiveExamId, number, title, youtubeUrl, imageUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "저장하지 못했습니다.");
      setSaved((current) => [...current.filter((item) => item.content_key !== result.explanation.content_key), result.explanation]);
      setMessage(`${number}번 해설 저장을 확인했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <section className="panel problem-browser"><h2>문제별 해설 등록</h2><p>학생이 문제번호를 누르면 이곳에 등록한 유튜브 영상과 풀이 이미지가 표시됩니다. 기존 오답 기록은 변경되지 않습니다.</p>
    <form className="form workspace-form" onSubmit={submit}>
      <label>자료 종류<select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setSchool(""); setExamId(""); }}><option value="xpattern">X-패턴 교재</option><option value="school">학교 기출</option></select></label>
      {kind === "xpattern" && <label>교재<select value={effectiveBook} onChange={(event) => { setBook(event.target.value); setSchool(""); setExamId(""); }}>{xBooks.map((item) => <option key={item}>{item}</option>)}</select></label>}
      <label>학교<select value={effectiveSchool} onChange={(event) => { setSchool(event.target.value); setExamId(""); }}>{schools.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>시험<select value={effectiveExamId} onChange={(event) => setExamId(event.target.value)}>{schoolOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>문제번호 (1~{max || "?"})<input type="number" min={1} max={max || undefined} value={number || ""} onChange={(event) => setNumber(event.target.value === "" ? 0 : Number(event.target.value))} required /></label>
      <label>해설 제목<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="선택 사항" /></label>
      <label>유튜브 영상 주소<input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtu.be/…" /></label>
      <label>풀이 이미지 주소<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://… (선택 사항)" /></label>
      <button className="primary" disabled={busy || !effectiveExamId || (!youtubeUrl && !imageUrl)}>해설 저장하기</button>
    </form>{message && <p className="workspace-message" role="status">{message}</p>}
    {existing && <p className="problem-browser-note">현재 {safeNumber}번에 등록된 자료: {existing.youtube_video_id ? "유튜브 영상 " : ""}{existing.image_url ? "풀이 이미지" : ""}</p>}
  </section>;
}

