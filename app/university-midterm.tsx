"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import katex from "katex";
import { midtermSets, type MathBlock, type ExamQuestion } from "../lib/calculus-midterm";
import "katex/dist/katex.min.css";
import "./university-midterm.css";

type Answer = { text: string; math: string; endpoint?: [number, number] };
type Saved = { version: 1; answers: Record<string, Answer>; scores: Record<string, number>; revealed: boolean };
const emptyAnswer: Answer = { text: "", math: "" };

const Formula = memo(function Formula({ tex, editable = false }: { tex: string; editable?: boolean }) {
  const rendered = useMemo(() => {
    try { return { html: katex.renderToString(tex, { displayMode: true, throwOnError: true, trust: false, strict: "error", output: "htmlAndMathml" }) }; }
    catch { return { error: true }; }
  }, [tex]);
  if (rendered.error) return <p className="uq-math-error" role="status">{editable ? "수식 입력을 확인해 주세요. 분수는 \\frac{분자}{분모}처럼 입력합니다." : "수식을 표시하지 못했습니다. 페이지를 새로고침해 주세요."}</p>;
  return <div className="uq-math" tabIndex={0} aria-label="수식" dangerouslySetInnerHTML={{ __html: rendered.html }} />;
});
function Blocks({ items }: { items: MathBlock[] }) {
  return <>{items.map((b,i)=><div className="uq-block" key={i}>{b.text&&<p>{b.text}</p>}{b.math&&<Formula tex={b.math}/>}</div>)}</>;
}
function VectorGraph({ start, endpoint, onChange }: { start: [number,number]; endpoint?: [number,number]; onChange?: (point:[number,number])=>void }) {
  const marker=useId().replace(/:/g,"");
  const xy=(p:[number,number])=>[42+p[0]*49,250-p[1]*49];
  const a=xy(start),b=endpoint?xy(endpoint):null;
  return <div className="uq-graph"><svg viewBox="0 0 300 295" role="img" aria-label={endpoint?`벡터: 시점 (${start}), 종점 (${endpoint})`:`시점 P (${start})인 좌표평면`} onClick={onChange?(e)=>{const r=e.currentTarget.getBoundingClientRect();onChange([Math.max(0,Math.min(4,Math.round(((e.clientX-r.left)/r.width*300-42)/49))),Math.max(0,Math.min(4,Math.round((250-(e.clientY-r.top)/r.height*295)/49)))]);}:undefined}>
    <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#16794f"/></marker></defs>
    {[0,1,2,3,4].map(n=><g key={n}><path d={`M${42+n*49},40 V250 M42,${250-n*49} H252`} stroke="#dce5df" strokeDasharray="3 3"/><text x={42+n*49} y="270" textAnchor="middle">{n}</text>{n>0&&<text x="28" y={255-n*49} textAnchor="middle">{n}</text>}</g>)}
    <path d="M42,30 V250 H267" fill="none" stroke="#718378" strokeWidth="1.5"/><text x="277" y="255">x</text><text x="36" y="22">y</text>
    {b&&<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#16794f" strokeWidth="3" markerEnd={`url(#${marker})`}/>}
    <circle cx={a[0]} cy={a[1]} r="4" fill="#273c30"/><text x={a[0]+8} y={a[1]+17}>P</text>{b&&<><circle cx={b[0]} cy={b[1]} r="3" fill="#16794f"/><text x={b[0]+8} y={b[1]-7}>Q</text></>}
  </svg>{onChange&&<fieldset className="uq-coordinate-inputs"><legend>종점을 누르거나 좌표를 입력하세요</legend>{([0,1] as const).map(i=><label key={i}>{i===0?"x":"y"}좌표<input type="number" min={0} max={4} step={1} value={endpoint?.[i]??""} onChange={e=>{if(e.target.value!==""){const next:[number,number]=endpoint?[...endpoint]:[...start];next[i]=Math.max(0,Math.min(4,Math.round(Number(e.target.value))));onChange(next);}}}/></label>)}</fieldset>}</div>;
}
function AnswerEditor({ question:q,value,onChange }: {question:ExamQuestion;value:Answer;onChange:(answer:Answer)=>void}) {
  return <div className="uq-editor">{q.graph&&<VectorGraph start={q.graph.start} endpoint={value.endpoint} onChange={endpoint=>onChange({...value,endpoint})}/>}
    <label className="uq-answer-label">{q.points===10?"내 답·풀이 과정":"내 답"}<textarea aria-label={`${q.number}번 답안`} value={value.text} maxLength={5000} rows={q.points===10?4:2} placeholder={q.points===10?"풀이 과정과 최종 답을 적어 보세요.":"답을 적어 보세요. 수식은 아래에서 입력할 수 있어요."} onChange={e=>onChange({...value,text:e.target.value})}/></label>
    <details className="uq-math-editor"><summary>수식으로 답 쓰기</summary><div className="uq-math-tools">{[["분수",String.raw`\frac{1}{2}`],["루트",String.raw`\sqrt{2}`],["벡터",String.raw`\left(1,2,3\right)`],["급수",String.raw`\sum_{n=1}^{\infty}\frac{1}{n^2}`]].map(([label,tex])=><button type="button" key={label} onClick={()=>onChange({...value,math:value.math+tex})}>{label}</button>)}</div><label>수식 입력<input aria-label={`${q.number}번 수식 답안`} value={value.math} maxLength={1200} spellCheck={false} placeholder={String.raw`예: \frac{2}{3}`} onChange={e=>onChange({...value,math:e.target.value})}/></label>{value.math&&<div className="uq-math-preview"><span>수식 미리보기</span><Formula tex={value.math} editable/></div>}</details>
  </div>;
}
function readSaved(raw:string,questions:ExamQuestion[]):Saved|null {
  try{const v=JSON.parse(raw);if(v.version!==1)return null;const answers:Saved["answers"]={},scores:Saved["scores"]={};for(const q of questions){const a=v.answers?.[q.id];if(a&&typeof a.text==="string"&&typeof a.math==="string"){answers[q.id]={text:a.text.slice(0,5000),math:a.math.slice(0,1200)};if(q.graph&&Array.isArray(a.endpoint)&&a.endpoint.length===2&&a.endpoint.every((n:unknown)=>typeof n==="number"&&Number.isInteger(n)&&n>=0&&n<=4))answers[q.id].endpoint=a.endpoint;}const s=v.scores?.[q.id];if(Number.isInteger(s)&&s>=0&&s<=q.points&&(q.points===10||s===0||s===5))scores[q.id]=s;}return{version:1,answers,scores,revealed:v.revealed===true};}catch{return null;}
}
function ExamSession({setId,userEmail,back}:{setId:string;userEmail:string;back:()=>void}) {
  const exam=midtermSets.find(s=>s.id===setId)!;
  const original=setId==="original",storageKey=`studygyeol:midterm:v1:${userEmail.toLowerCase()}:${setId}`;
  const [saved,setSaved]=useState<Saved>({version:1,answers:{},scores:{},revealed:original});
  const [ready,setReady]=useState(false),[storageError,setStorageError]=useState(false),[onlyReview,setOnlyReview]=useState(false),[confirmReset,setConfirmReset]=useState(false);
  useEffect(()=>{if(!original){try{const raw=localStorage.getItem(storageKey);const v=raw?readSaved(raw,exam.questions):null;if(v)setSaved(v);}catch{setStorageError(true);}}setReady(true);},[storageKey,original,exam.questions]);
  useEffect(()=>{if(!ready||original)return;try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{setStorageError(true);}},[saved,ready,original,storageKey]);
  const answered=exam.questions.filter(q=>{const a=saved.answers[q.id];return a&&(a.text.trim()||a.math.trim()||a.endpoint);}).length;
  const marked=Object.keys(saved.scores).length,score=Object.values(saved.scores).reduce((a,b)=>a+b,0);
  const review=exam.questions.filter(q=>saved.scores[q.id]!==undefined&&saved.scores[q.id]<q.points),visible=onlyReview?review:exam.questions;
  if(!ready)return <section className="panel" role="status">답안을 불러오고 있어요.</section>;
  return <>
    <div className="uq-toolbar"><button type="button" className="ghost" onClick={back}>← 세트 목록</button><span>{original?"원본 16문항 해설":`답안 작성 ${answered} / 16`}</span></div>
    <header className="panel uq-exam-header"><span className="uq-eyebrow">STUDY GYEOL · CALCULUS II</span><h2>미적분학2 중간고사 대비<br/><span>{exam.title}</span></h2><p>단답형 12문항 × 5점 + 서술형 4문항 × 10점 = 100점</p><div className="uq-exam-tags"><span>7장 무한급수</span><span>8장 벡터와 공간기하</span><span>계산기 없이 연습</span></div></header>
    {original&&<p className="uq-notice">원본 2번은 n=0일 때 분모가 0입니다. 시작 지수를 n=1로 보정한 식을 기준으로 해설했습니다.</p>}
    {!original&&<p className="uq-note">답안은 이 계정의 현재 브라우저에 자동 저장됩니다. 다른 기기와 동기화되지는 않습니다. {storageError&&"현재 저장을 사용할 수 없습니다. 페이지를 닫기 전에 답안을 별도로 보관해 주세요."}</p>}
    <nav className="uq-jump" aria-label="문제 바로가기"><a href="#uq-short">단답형 1번</a><a href="#uq-essay">서술형 2~5번</a>{!original&&<a href="#uq-finish">풀이 확인·자가 채점</a>}</nav>
    {!original&&saved.revealed&&<div className="panel uq-score-panel"><div><span className="uq-eyebrow">SELF REVIEW · 자가 채점</span><h3>{marked===16?`${score} / 100점`:`${marked} / 16문항 채점 완료`}</h3><p>{marked===16?"해설과 비교해 직접 매긴 점수입니다.":`현재 입력한 점수 ${score}점 · 각 문제 아래에서 점수를 선택하세요.`}</p></div><label><input type="checkbox" checked={onlyReview} onChange={e=>setOnlyReview(e.target.checked)}/> 복습할 문제만 ({review.length})</label></div>}
    {([5,10] as const).map(points=><section key={points} id={points===5?"uq-short":"uq-essay"} className="uq-part"><div className="uq-part-heading"><h3>{points===5?"1. 단답형":"2~5. 서술형"}</h3><span>{points===5?"각 5점 · 답란에 기입":"각 10점 · 풀이과정에 따른 부분점수"}</span></div>{visible.filter(q=>q.points===points).map(q=><article className="panel uq-question" key={q.id}><div className="uq-question-heading"><h4><span>{q.number}</span> {q.title}</h4><span>{q.points}점</span></div><div className="uq-prompt"><Blocks items={q.prompt}/></div>
      {!original&&<AnswerEditor question={q} value={saved.answers[q.id]||emptyAnswer} onChange={answer=>setSaved(v=>({...v,answers:{...v.answers,[q.id]:answer}}))}/>}
      {saved.revealed&&<div className="uq-solution-section"><div className="uq-answer"><strong>정답{q.number==="1-(11)"?" 예시":""}</strong><Blocks items={q.answer}/>{q.graph&&<VectorGraph start={q.graph.start} endpoint={q.graph.end}/>}</div><details className="uq-solution" open={original}><summary>풀이 과정 보기</summary><ol>{q.solution.map((step,i)=><li key={i}><Blocks items={[step]}/></li>)}</ol></details>{!original&&<label className="uq-mark">자가 채점<select aria-label={`${q.number}번 점수`} value={saved.scores[q.id]??""} onChange={e=>setSaved(v=>({...v,scores:{...v.scores,[q.id]:Number(e.target.value)}}))}><option value="" disabled>점수 선택</option>{(q.points===5?[0,5]:Array.from({length:11},(_,i)=>i)).map(n=><option key={n} value={n}>{n}점{n===q.points?" · 정답":n===0?" · 다시 복습":" · 부분점수"}</option>)}</select></label>}</div>}
    </article>)}</section>)}
    {onlyReview&&review.length===0&&<div className="panel">현재 복습 대상으로 표시된 문제가 없습니다. 점수를 먼저 선택하거나 필터를 해제하세요.</div>}
    {!original&&<footer id="uq-finish" className="panel uq-finish">{!saved.revealed?<><h3>이제 풀이를 확인해 볼까요?</h3><p>{answered<16?`아직 작성하지 않은 문제가 ${16-answered}개 있어요. 풀이를 열어도 작성한 답안은 유지됩니다.`:"16문항의 답안을 모두 작성했습니다."}</p><button type="button" className="primary" onClick={()=>setSaved(v=>({...v,revealed:true}))}>정답·풀이 열고 자가 채점</button></>:<><h3>{marked===16?`자가 채점 결과 ${score}점`:`자가 채점 ${marked}/16문항`}</h3><p>서술형은 풀이의 각 단계를 비교해 부분점수를 직접 입력하세요. 자동 채점 점수가 아닙니다.</p><button type="button" className="ghost" onClick={()=>{setSaved(v=>({...v,revealed:false}));setOnlyReview(false);}}>정답 숨기고 다시 풀기</button></>}<div className="uq-reset">{confirmReset?<><span>이 세트의 답안과 점수를 지우고 다시 시작할까요?</span><button type="button" className="ghost" onClick={()=>{setSaved({version:1,answers:{},scores:{},revealed:false});setOnlyReview(false);setConfirmReset(false);}}>이 세트 초기화</button><button type="button" className="ghost" onClick={()=>setConfirmReset(false)}>취소</button></>:<button type="button" className="uq-text-button" onClick={()=>setConfirmReset(true)}>이 세트 답안 초기화</button>}</div></footer>}
  </>;
}
export default function UniversityMidterm({userEmail}:{userEmail:string}) {
  const [selected,setSelected]=useState<string|null>(null);
  return <section className="uq" aria-label="미적분학2 중간고사 데모 퀴즈">{selected?<ExamSession key={`${userEmail}:${selected}`} setId={selected} userEmail={userEmail} back={()=>setSelected(null)}/>:<>
    <div className="panel uq-hero"><div><span className="uq-eyebrow">대학생 공개 데모 · CALCULUS II</span><h2>시험과 같은 형식으로,<br/>세 번 더 연습하세요.</h2><p>중간고사 대비 자료에 맞춘 변형 퀴즈 3세트.<br/>단답형부터 서술형까지 직접 풀고, 정답과 풀이를 확인하세요.</p></div><div className="uq-hero-symbol" aria-hidden="true"><Formula tex={String.raw`\sum_{n=1}^{\infty}\frac{x^n}{n}`}/><span>7장 · 8장</span></div></div>
    <div className="uq-original"><div><span className="uq-eyebrow">먼저 개념을 확인하고 싶다면</span><h3>원본 문제 정답·해설</h3><p>제공한 중간고사 대비 자료의 16문항을 단계별로 풀이했어요.</p></div><button type="button" className="ghost" onClick={()=>setSelected("original")}>원본 해설 보기 →</button></div>
    <div className="uq-sets">{midtermSets.filter(s=>s.id!=="original").map((s,i)=><article className="panel uq-set" key={s.id}><span className="uq-set-number">0{i+1}</span><span className="uq-tag">16문항 · 100점</span><h3>{s.title}</h3><p>단답형 12문항 + 서술형 4문항</p><ul><li>원본과 같은 문제 순서·유형</li><li>새로운 수치와 조건</li><li>벡터 그리기·수식 답안 입력</li></ul><button type="button" className="primary" onClick={()=>setSelected(s.id)}>풀기 / 이어서 풀기 →</button></article>)}</div>
    <p className="uq-note">대학생으로 로그인한 모든 이용자가 사용할 수 있는 데모입니다. 서술형·동치 수식·자유 예시 답안은 정답과 비교해 자가 채점합니다. 최근 답안과 점수는 세트별로 현재 브라우저에 저장됩니다.</p>
  </>}<p className="uq-source">기준 자료: 「중간고사 대비 미적2」 · 미적분학2 7장 무한급수, 8장 벡터와 공간기하. 변형 세트는 문제 형식과 개념을 유지하고 수치·조건을 새롭게 구성했습니다.</p></section>;
}
