"use client";

import { useEffect, useRef, useState } from "react";
import { pythonLessons } from "./python-lessons";
import { examplesForChapter } from "./python-foundations";
import "./python-lab.css";

export default function PythonLab() {
  const [chapter, setChapter] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [code, setCode] = useState(examplesForChapter(1)[0].lesson.exampleCode);
  const [completed, setCompleted] = useState<string[]>([]);
  const [output, setOutput] = useState("코드를 실행하면 결과가 여기에 표시됩니다.");
  const [running, setRunning] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);
  const examples = examplesForChapter(chapter + 1);
  const selected = examples[exampleIndex] ?? examples[0];
  const lesson = selected.lesson;
  const walkthrough = selected.walkthrough;

  useEffect(() => () => {
    worker.current?.terminate();
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function chooseExample(nextChapter: number, index: number) {
    worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    ++runId.current;
    setRunning(false);
    setChapter(nextChapter);
    setExampleIndex(index);
    setCode(examplesForChapter(nextChapter + 1)[index].lesson.exampleCode);
    setOutput("코드를 실행하면 결과가 여기에 표시됩니다.");
    setShowHint(false);
    setShowSolution(false);
  }

  function run() {
    if (!code.trim() || running || selected.desktop) return;
    setRunning(true);
    setOutput("파이썬을 준비하고 실행하는 중입니다… 첫 실행은 잠시 걸릴 수 있어요.");
    if (!worker.current) worker.current = new Worker("/python-lab-worker.js");
    const current = ++runId.current;
    worker.current.onmessage = ({ data }: MessageEvent<{ id: number; output: string; failed?: boolean }>) => {
      if (data.id !== runId.current) return;
      if (timer.current) clearTimeout(timer.current);
      setRunning(false);
      setOutput(data.output.slice(0, 5000));
    };
    worker.current.onerror = () => {
      if (timer.current) clearTimeout(timer.current);
      worker.current?.terminate(); worker.current = null;
      setRunning(false);
      setOutput("실행 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
    };
    worker.current.postMessage({ type: "run", id: current, code });
    timer.current = setTimeout(() => {
      worker.current?.terminate(); worker.current = null;
      setRunning(false);
      setOutput("실행 시간이 길어 중단했습니다. 무한 반복이 있는지 확인해 주세요.");
    }, 20000);
  }

  return <section className="panel python-lab" aria-labelledby="python-lab-title">
    <div className="python-lab-heading"><div><span className="badge">대학생 · 기초프로그래밍2</span><h2 id="python-lab-title">파이썬 연습실</h2><p>개념을 읽고, 예제를 바꿔 실행하고, 직접 문제를 풀어보세요. 코드는 이 브라우저에서 실행됩니다.</p></div></div>
    <nav className="python-chapters" aria-label="파이썬 단원">{pythonLessons.map((item, index) => <button key={item.chapter} type="button" aria-current={chapter === index ? "step" : undefined} className={chapter === index ? "active" : ""} onClick={() => chooseExample(index, 0)}>{item.chapter}장 <span>{item.title}</span></button>)}</nav>
    <div className="python-example-navigation">
      <label htmlFor="python-example-select">소단원 · 예제 선택 ({examples.length}개)</label>
      <select id="python-example-select" value={exampleIndex} onChange={event => chooseExample(chapter, Number(event.target.value))}>
        {Array.from(new Set(examples.map(item => item.section))).map(section => <optgroup key={section} label={section}>{examples.map((item, index) => item.section === section && <option key={item.id} value={index}>{completed.includes(item.id) ? '✓ ' : ''}{index + 1}. {item.lesson.title}{item.desktop ? ' · PC 실습' : ''}</option>)}</optgroup>)}
      </select>
      <div className="python-example-controls"><button type="button" disabled={exampleIndex === 0} onClick={() => chooseExample(chapter, exampleIndex - 1)}>← 이전 예제</button><span>{exampleIndex + 1} / {examples.length}</span><button type="button" disabled={exampleIndex === examples.length - 1} onClick={() => chooseExample(chapter, exampleIndex + 1)}>다음 예제 →</button></div>
      <p>{selected.source} · 강의 주제 기반 자체 구성 예제</p>
      <button type="button" aria-pressed={completed.includes(selected.id)} onClick={() => setCompleted(current => current.includes(selected.id) ? current.filter(id => id !== selected.id) : [...current, selected.id])}>{completed.includes(selected.id) ? '✓ 복습 완료 표시됨' : '이 예제 복습 완료 표시'}</button><small>완료 표시는 현재 화면 이용 중에만 유지됩니다.</small>
    </div>
    <div className="python-lesson-grid"><div className="python-lesson-copy">
      <span className="python-overline">Chapter {String(lesson.chapter).padStart(2, "0")}</span><h3>{lesson.title}</h3><p>{lesson.summary}</p>
      <h4>핵심 정리</h4><ul>{lesson.points.map((point) => <li key={point}>{point}</li>)}</ul>
      <div className="python-example"><h4>예제 · {lesson.exampleTitle}</h4><pre><code>{lesson.exampleCode}</code></pre><p>{lesson.exampleExplanation}</p><button type="button" className="ghost" onClick={() => { setCode(lesson.exampleCode); setOutput("예제를 불러왔습니다. 실행 버튼을 눌러보세요."); }}>예제 코드 불러오기</button>
        <details className="python-walkthrough" key={selected.id} open><summary>예제 풀이 · 한 줄씩 이해하기</summary><ol>{walkthrough.steps.map(step => <li key={step}>{step}</li>)}</ol><h4>이 코드의 실행 결과</h4><pre><code>{walkthrough.output}</code></pre><p className="python-note"><strong>자주 틀리는 부분</strong><br />{walkthrough.mistake}</p></details>
      </div>
      <div className="python-challenge"><h4>직접 해보기</h4><p>{lesson.challenge}</p><button type="button" className="ghost" onClick={() => { setCode(lesson.starterCode); setOutput("연습 문제를 불러왔습니다."); }}>연습 코드 불러오기</button><div className="python-help"><button type="button" onClick={() => setShowHint(!showHint)} aria-expanded={showHint}>힌트 {showHint ? "접기" : "보기"}</button><button type="button" onClick={() => setShowSolution(!showSolution)} aria-expanded={showSolution}>풀이 {showSolution ? "접기" : "보기"}</button></div>{showHint && <p className="python-note">{lesson.hint}</p>}{showSolution && <div className="python-note"><h4>풀이 과정</h4><ol>{walkthrough.practiceSteps.map(step => <li key={step}>{step}</li>)}</ol><h4>정답 코드 예시</h4><pre><code>{lesson.solution}</code></pre><p>예상 결과: {lesson.expected}</p><button type="button" className="ghost" onClick={() => { setCode(lesson.solution); setOutput("정답 코드를 불러왔습니다. 값을 바꾸어 다시 실행해 보세요."); }}>정답 코드 실행해 보기</button></div>}</div>
    </div><div className="python-editor"><div className="python-editor-title"><h4>코드 작성</h4><span>{selected.desktop ? 'PC Python / IDLE 실습' : 'Python 3 · 브라우저 실행'}</span></div>{selected.desktop && <p className="python-note">그래픽 창이 필요한 예제입니다. 코드를 PC의 Python/IDLE에 복사해서 실행하세요.</p>}<label htmlFor="python-code">직접 코드를 수정해 보세요</label><textarea id="python-code" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} /><button className="primary" type="button" onClick={run} disabled={running || !code.trim() || selected.desktop}>{selected.desktop ? 'PC에서 실행하는 예제' : running ? "실행 중…" : "▶ 코드 실행"}</button><div className="python-output"><h4>실행 결과</h4><pre role="status" aria-live="polite">{output}</pre></div><p className="python-safety">긴 반복은 20초 후 중단됩니다. 이 연습실은 입력창이 필요한 input(), 거북이 그래픽, 파일 저장을 지원하지 않습니다. 입력 예제는 미리 지정한 문자열로 연습합니다.</p></div></div>
  </section>;
}

