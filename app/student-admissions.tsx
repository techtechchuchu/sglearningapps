"use client";

import { useMemo, useState } from "react";
import { ADMISSION_SOURCES, ADMISSION_UNIVERSITIES, AdmissionGroup, official2027UniversityUrl } from "../lib/admissions";
import "./student-admissions.css";

type GradeSystem = "9" | "5";
type GroupFilter = "전체" | AdmissionGroup;
const GROUPS: GroupFilter[] = ["전체", "수도권 주요 대학", "국숭세단·광명상가", "지역 대학"];

export default function StudentAdmissions() {
  const [system, setSystem] = useState<GradeSystem>("9");
  const [group, setGroup] = useState<GroupFilter>("전체");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [nursing, setNursing] = useState(false);

  const maxGrade = system === "9" ? 9 : 5;
  const parsedGrade = grade.trim() === "" ? null : Number(grade);
  const gradeIsValid = parsedGrade === null || (Number.isFinite(parsedGrade) && parsedGrade >= 1 && parsedGrade <= maxGrade);
  const admissionYear = system === "9" ? 2027 : 2028;
  const sourceUrl = system === "9" ? ADMISSION_SOURCES.year2027 : ADMISSION_SOURCES.year2028;

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("ko-KR");
    return ADMISSION_UNIVERSITIES.filter((item) =>
      (group === "전체" || item.group === group) &&
      (!term || `${item.name} ${item.region}`.toLocaleLowerCase("ko-KR").includes(term)),
    );
  }, [group, query]);

  return <section className="panel admission-explorer" aria-labelledby="admission-title">
    <div className="admission-heading">
      <div><span className="badge">대학 탐색</span><h2 id="admission-title">내 내신과 대학 입시 자료</h2><p>대학·학과·전형마다 평가 기준이 다릅니다. 먼저 학년의 내신 체계를 선택하고 공식 자료를 확인해 주세요.</p></div>
    </div>

    <fieldset className="admission-systems"><legend>내신 체계 · 표시할 자료연도</legend><div>
      <button type="button" className={system === "9" ? "active" : ""} aria-pressed={system === "9"} onClick={() => { setSystem("9"); setGrade(""); }}>9등급제 · 2027학년도 자료</button>
      <button type="button" className={system === "5" ? "active" : ""} aria-pressed={system === "5"} onClick={() => { setSystem("5"); setGrade(""); }}>5등급제 · 2028학년도 자료</button>
    </div></fieldset>

    <div className="admission-inputs"><label>현재 내신 평균등급 <span>(선택 · 분석 전 참고 입력, 저장되지 않음)</span><input type="number" min="1" max={maxGrade} step="0.01" inputMode="decimal" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder={`1~${maxGrade}등급`} aria-invalid={!gradeIsValid} /></label><label>대학명 검색<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 부산대학교" /></label></div>
    {!gradeIsValid && <p className="admission-error" role="alert">{system}등급제에서는 1~{maxGrade} 사이의 등급을 입력해 주세요.</p>}
    <div className="admission-disclosure" role="note"><strong>합격 가능성 판정 전 꼭 확인해 주세요</strong><p>입력한 평균등급만으로 대학별 환산점수나 합격 가능성을 계산할 수 없습니다. 과목·이수단위, 전형, 학과, 수능 최저, 지역인재 자격 등이 필요합니다. 이 화면은 성적을 저장하거나 9등급을 5등급으로 자동 변환하지 않습니다.</p>{system === "5" && <p>2028학년도는 5등급제 적용 첫해로, 실제 합격자 내신 결과가 아직 없습니다. 과거 9등급제 결과는 5등급제 합격선이 아닙니다.</p>}</div>

    <div className="admission-source-links"><a href={sourceUrl} target="_blank" rel="noopener noreferrer">{admissionYear}학년도 공식 자료 보기 ↗</a><a href={ADMISSION_SOURCES.scoreAnalysis} target="_blank" rel="noopener noreferrer">대입정보포털에서 대학별 점수 분석 ↗</a><a href={ADMISSION_SOURCES.reform} target="_blank" rel="noopener noreferrer">내신 5등급제 교육부 안내 ↗</a></div>

    <div className="admission-filter-bar"><div role="group" aria-label="대학 지역·그룹">{GROUPS.map((item) => <button key={item} type="button" aria-pressed={group === item} className={group === item ? "active" : ""} onClick={() => setGroup(item)}>{item}</button>)}</div><button type="button" className={nursing ? "admission-nursing active" : "admission-nursing"} aria-pressed={nursing} onClick={() => setNursing((current) => !current)}>간호학과 자료 안내</button></div>
    {nursing && <div className="admission-disclosure"><strong>간호학과는 별도 확인이 필요합니다.</strong><p>이 대학 목록이 모두 간호학과를 운영한다는 뜻은 아닙니다. 대입정보포털에서 해당 대학의 설치학과와 모집단위·캠퍼스·전형을 확인해 주세요. 검증된 대학별 간호학과 자료는 확인 후 이곳에 연결합니다.</p></div>}

    <p className="admission-count">탐색 대상 {visible.length}개 대학 · 대학명은 공식 입시결과가 아닌 탐색 목록입니다.</p>
    <div className="admission-list">{visible.map((item) => <article key={item.name} className="admission-school"><div className="admission-school-main"><span className="admission-logo-pending" aria-hidden="true">{item.name.slice(0, 1)}</span><div><span>{item.group} · {item.region}</span><h3>{item.name}</h3>{item.note && <p>{item.note}</p>}</div></div><div className="admission-school-footer"><span>학과·전형별 수치: 검증 중</span><a href={system === "9" && item.verified2027Code ? official2027UniversityUrl(item.verified2027Code) : sourceUrl} target="_blank" rel="noopener noreferrer">{system === "9" && item.verified2027Code ? "이 대학 공식 자료 ↗" : "공식 자료 목록에서 찾기 ↗"}</a></div></article>)}</div>
    {visible.length === 0 && <p>검색 결과가 없습니다. 다른 대학명을 입력해 주세요.</p>}
    <p className="admission-footnote">카드의 첫 글자 표시는 대학 로고가 아닙니다. 공식 로고는 사용 가능 여부와 원본 파일을 확인한 후 적용합니다. 공식 수치와 추정 범위는 구분해 표시할 예정이며, 대학별 자료·산식 검증이 완료되지 않은 항목에는 숫자나 합격 판정을 표시하지 않습니다. 최종 지원 전에는 반드시 해당 대학의 최신 모집요강을 확인해 주세요.</p>
  </section>;
}

