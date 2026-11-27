"use client";

import { useState } from "react";
import { displayProblemNumbers, matchesRosterBook, splitRosterBooks } from "../lib/wrong-answers";
import { formatKoreanDbTime } from "../lib/db-time";
import styles from "./teacher-answer-list.module.css";

type Row = Record<string, any>;
type AnswerType = "normal" | "variant";
const PAGE_SIZE = 20;

function isVariantRequest(row: Row) {
  return String(row.memo || "").includes("[변형문제 요청");
}

export default function TeacherAnswerList({ answers, roster }: { answers: Row[]; roster: Row[] }) {
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<AnswerType>("normal");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const classes = [...new Set(roster.map((row) => String(row.class_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
  const classBooks = new Map<string, Set<string>>();
  if (selectedClass) {
    for (const row of roster) {
      if (row.class_name !== selectedClass) continue;
      const name = String(row.student_name || "").trim();
      const books = classBooks.get(name) || new Set<string>();
      splitRosterBooks(row.book_name).forEach((book) => books.add(book));
      classBooks.set(name, books);
    }
  }
  const query = search.trim().toLocaleLowerCase("ko");
  const scopedAnswers = answers.filter((row) => {
    const name = String(row.username || "").trim();
    return name.toLocaleLowerCase("ko").includes(query)
      && (!selectedClass || matchesRosterBook(classBooks.get(name) || new Set<string>(), row.unit));
  });
  const normalCount = scopedAnswers.filter((row) => !isVariantRequest(row)).length;
  const variantCount = scopedAnswers.length - normalCount;
  const results = scopedAnswers
    .filter((row) => isVariantRequest(row) === (type === "variant"))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const visibleRows = results.slice(0, visibleCount);
  const totals = new Map<string, number>();
  for (const row of results) {
    const name = String(row.username || "").trim();
    totals.set(name, (totals.get(name) || 0) + 1);
  }
  const groups = new Map<string, Row[]>();
  for (const row of visibleRows) {
    const name = String(row.username || "").trim();
    groups.set(name, [...(groups.get(name) || []), row]);
  }

  return <section className={`panel ${styles.panel}`}>
    <div className={styles.heading}><div><h2>학생 오답 현황</h2><p>학생별로 묶어 표시합니다. 이름을 누르면 문제번호와 제출 시각을 볼 수 있습니다.</p></div><span aria-live="polite">검색 결과 {results.length}건</span></div>
    <div className={styles.filters}>
      <label>반 선택
        <select value={selectedClass} onChange={(event) => { setSelectedClass(event.target.value); setVisibleCount(PAGE_SIZE); }}>
          <option value="">전체 반</option>
          {classes.map((className) => <option key={className} value={className}>{className}</option>)}
        </select>
      </label>
      <label>학생 이름 검색
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="이름을 입력하세요" />
      </label>
    </div>
    <div className={styles.tabs} role="group" aria-label="기록 종류">
      <button type="button" className={type === "normal" ? styles.active : ""} aria-pressed={type === "normal"} onClick={() => { setType("normal"); setVisibleCount(PAGE_SIZE); }}>일반 오답 <span>{normalCount}</span></button>
      <button type="button" className={type === "variant" ? styles.active : ""} aria-pressed={type === "variant"} onClick={() => { setType("variant"); setVisibleCount(PAGE_SIZE); }}>변형문제 요청 <span>{variantCount}</span></button>
    </div>
    <div className={styles.groups}>
      {groups.size ? [...groups].map(([name, rows]) => <details key={name} className={styles.group}>
        <summary><strong>{name}</strong><span>{type === "variant" ? "요청" : "제출"} {totals.get(name)}건</span><small>최근 {rows[0]?.created_at ? formatKoreanDbTime(rows[0].created_at) : "시각 없음"}</small></summary>
        <div className={styles.records}>{rows.map((row, index) => {
          const memo = String(row.memo || "").replace(/\s*\[변형문제 요청[^\]]*\]/g, "").trim();
          return <div className={styles.record} key={row.id ?? `${name}-${index}`}>
            <strong>{row.unit} · {displayProblemNumbers(row.unit, row.problem)}번</strong>
            <span>{memo && `${memo} · `}{row.created_at ? formatKoreanDbTime(row.created_at) : "제출 시각 없음"}</span>
          </div>;
        })}</div>
      </details>) : <p className={styles.empty}>조건에 맞는 기록이 없습니다.</p>}
    </div>
    {results.length > visibleCount && <button type="button" className={styles.more} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>20건 더 보기 <span>({visibleCount}/{results.length}건 표시)</span></button>}
  </section>;
}
