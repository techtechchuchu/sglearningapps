"use client";

import { useEffect, useMemo, useState } from "react";
import { parseProblemNumbers } from "../lib/wrong-answers";
import { bookExamOptions, explanationKey, type Explanation } from "../lib/problem-explanations";

type Row = Record<string, any>;
type Exam = { id: number; school_name: string; display_name: string; exam_year: number; exam_type: string; question_count: number };
type SchoolAnswer = { id: number; exam_id: number; problem: string; memo: string; created_at: string };

export default function StudentProblemBrowser({ books, schoolExams, wrongAnswers, schoolAnswers, onWrite }: {
  books: string[];
  schoolExams: Exam[];
  wrongAnswers: Row[];
  schoolAnswers: SchoolAnswer[];
  onWrite: (kind: "xpattern" | "school", book: string, examId: string, number: number) => void;
}) {
  const [kind, setKind] = useState<"xpattern" | "school">("xpattern");
  const [book, setBook] = useState(books[0] || "");
  const [school, setSchool] = useState("");
  const [examId, setExamId] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [media, setMedia] = useState<Explanation[]>([]);
  const [mediaMessage, setMediaMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveBook = books.includes(book) ? book : books[0] || "";
  const options = kind === "xpattern" ? (effectiveBook ? bookExamOptions(effectiveBook) : []) : schoolExams.map((exam) => ({ id: String(exam.id), school: exam.school_name, label: exam.display_name || `${exam.exam_year} ${exam.school_name} ${exam.exam_type}`, max: Number(exam.question_count) || 20, offset: 0 }));
  const schools = [...new Set(options.map((option) => option.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const effectiveSchool = schools.includes(school) ? school : schools[0] || "";
  const schoolOptions = options.filter((option) => option.school === effectiveSchool);
  const effectiveExamId = schoolOptions.some((option) => option.id === examId) ? examId : schoolOptions[0]?.id || "";
  const exam = schoolOptions.find((option) => option.id === effectiveExamId);
  const max = Math.min(Number(exam?.max) || 0, 200);

  const mine = useMemo(() => {
    const numbers = new Map<number, string[]>();
    if (!exam) return numbers;
    if (kind === "xpattern") {
      for (const answer of wrongAnswers) {
        if (String(answer.unit || "") !== effectiveBook) continue;
        try {
          for (const raw of parseProblemNumbers(answer.problem)) {
            const number = Number(raw) - Number(exam.offset);
            if (number >= 1 && number <= max) numbers.set(number, [...(numbers.get(number) || []), String(answer.memo || "")]);
          }
        } catch { /* Ignore malformed historical rows. */ }
      }
    } else {
      for (const answer of schoolAnswers) {
        if (answer.exam_id !== Number(effectiveExamId)) continue;
        try {
          for (const raw of parseProblemNumbers(answer.problem)) {
            const number = Number(raw);
            if (number >= 1 && number <= max) numbers.set(number, [...(numbers.get(number) || []), String(answer.memo || "")]);
          }
        } catch { /* Ignore malformed historical rows. */ }
      }
    }
    return numbers;
  }, [kind, effectiveBook, effectiveExamId, exam, max, wrongAnswers, schoolAnswers]);

  useEffect(() => {
    setSelected(exam ? 1 : null);
    setMedia([]);
    setMediaMessage("");
    if (!exam) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ kind, book: effectiveBook, examId: effectiveExamId });
    setLoading(true);
    void fetch(`/api/problem-explanations?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.message || "해설 조회 실패"); return result; })
      .then((result) => { setMedia(result.explanations || []); if (!result.available) setMediaMessage("해설 자료 연결을 준비 중입니다."); })
      .catch((error) => { if (error.name !== "AbortError") setMediaMessage(error.message || "해설을 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, effectiveBook, effectiveExamId, exam?.id]);

  const visibleNumbers = Array.from({ length: max }, (_, index) => index + 1).filter((number) => !onlyMine || mine.has(number));
  const detail = selected && exam ? media.find((item) => item.content_key === explanationKey(kind, effectiveExamId, selected, effectiveBook)) : null;

  return <section className="panel problem-browser">
    <h2>문제별 해설 <small className="problem-demo-label">예시 화면</small></h2><p>교재 또는 학교 시험을 선택하고 문제번호를 누르세요. 내 오답은 별도로 표시됩니다.</p>
    <div className="problem-browser-filters">
      <label>자료 종류<select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setSchool(""); setExamId(""); }}><option value="xpattern">우리 교재</option><option value="school">학교 기출</option></select></label>
      {kind === "xpattern" && <label>교재<select value={effectiveBook} onChange={(event) => { setBook(event.target.value); setSchool(""); setExamId(""); }}>{books.map((item) => <option key={item}>{item}</option>)}</select></label>}
      <label>학교<select value={effectiveSchool} onChange={(event) => { setSchool(event.target.value); setExamId(""); }}>{schools.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>시험<select value={effectiveExamId} onChange={(event) => setExamId(event.target.value)}>{schoolOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    {!exam ? <p className="problem-browser-note">{kind === "xpattern" ? "현재 선택할 수 있는 교재가 없습니다." : "등록된 학교 기출 시험이 없습니다."}</p> : <>
      <div className="problem-browser-toolbar"><span>{exam.label} · 1~{max}번</span><label className="workspace-check"><input type="checkbox" checked={onlyMine} onChange={(event) => { setOnlyMine(event.target.checked); setSelected(null); }} /> 내 오답만 보기 ({mine.size})</label></div>
      {mediaMessage && <p className="problem-browser-note" role="status">{mediaMessage}</p>}
      <div className="problem-number-grid">{visibleNumbers.map((number) => {
        const key = explanationKey(kind, effectiveExamId, number, effectiveBook);
        const explanation = media.find((item) => item.content_key === key);
        return <button type="button" key={number} className={`problem-number${selected === number ? " selected" : ""}${mine.has(number) ? " is-wrong" : ""}`} onClick={() => setSelected(number)} aria-pressed={selected === number} aria-label={`${number}번${mine.has(number) ? ", 내 오답" : ""}${explanation?.youtube_video_id ? ", 해설 영상 있음" : ""}`}>
          {explanation?.youtube_video_id && <span className="problem-number-play" aria-hidden="true">▶</span>}
          {mine.has(number) && <span className="problem-number-dot" aria-hidden="true" />}
          <span className="problem-number-value">{number}</span>
        </button>;
      })}</div>
      {!visibleNumbers.length && <p className="problem-browser-note">이 시험에 저장한 오답이 없습니다. ‘내 오답만 보기’를 끄면 전체 문제를 볼 수 있습니다.</p>}
      {selected !== null && <div className="problem-detail"><div className="problem-detail-heading"><h3><span>{selected}번 풀이</span> {detail?.title && <small>{detail.title}</small>}</h3><button type="button" className="ghost" onClick={() => setSelected(null)}>닫기</button></div>
        {mine.has(selected) && <div className="problem-own-notes"><strong>내 오답 기록</strong>{mine.get(selected)?.map((note, index) => <p key={index}>{note || "메모 없이 저장됨"}</p>)}</div>}
        {detail?.youtube_video_id && <div className="problem-video"><iframe title={`${selected}번 해설 영상`} src={`https://www.youtube-nocookie.com/embed/${detail.youtube_video_id}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>}
        {!detail?.youtube_video_id && <div className="problem-video problem-video-empty" role="status"><span>해설 영상 자리</span><small>영상 링크 등록 전</small></div>}
        {detail?.image_url && <a href={detail.image_url} target="_blank" rel="noopener noreferrer" className="problem-solution-image"><img src={detail.image_url} alt={`${selected}번 풀이 이미지`} loading="lazy" /><span>이미지 크게 보기 ↗</span></a>}
        {!detail?.image_url && <div className="problem-image-empty">풀이 이미지 자리 <small>{loading ? "불러오는 중" : "이미지 등록 전"}</small></div>}
        {!mine.has(selected) && <button type="button" className="primary" onClick={() => onWrite(kind, effectiveBook, effectiveExamId, selected)}>이 문제 오답 작성하기</button>}
      </div>}
    </>}
  </section>;
}

