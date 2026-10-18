"use client";
import { useCallback, useEffect, useState } from "react";
import "./member-account.css";

type RequestRow={id:string;student_name:string;teacher_name:string;school:string;grade:string;requested_class:string;requested_books:string[];created_at:string};
type Roster={id:number;student_name:string;teacher_name:string;class_name:string;school_name:string;grade:string};
type ReviewData={requests:RequestRow[];roster:Roster[];books:string[]};
type Decision={id:string;approve:boolean;newRoster?:boolean;rosterId?:number;className?:string;school?:string;grade?:string;books?:string[]};

function ReviewItem({row,roster,books,busy,decide}:{row:RequestRow;roster:Roster[];books:string[];busy:boolean;decide:(input:Decision)=>Promise<void>}){
  const matching=roster.filter(item=>item.student_name===row.student_name&&item.teacher_name===row.teacher_name);
  const [mode,setMode]=useState<"existing"|"new">(matching.length?"existing":"new");
  const [rosterId,setRosterId]=useState("");
  const [className,setClassName]=useState(row.requested_class||"");
  const [school,setSchool]=useState(row.school||"");
  const [grade,setGrade]=useState(row.grade||"");
  const [selectedBooks,setSelectedBooks]=useState<string[]>(row.requested_books||[]);
  const [confirm,setConfirm]=useState(false);
  const valid=mode==="existing"?Boolean(rosterId):Boolean(className.trim()&&selectedBooks.length);
  function payload():Decision{
    return mode==="existing"?{id:row.id,approve:true,rosterId:Number(rosterId)}:
      {id:row.id,approve:true,newRoster:true,className,school,grade,books:selectedBooks};
  }
  return <article className="academy-review-item">
    <strong>{row.student_name} · {row.teacher_name}</strong>
    <span>{row.school||"학교 미등록"} · {row.grade||"학년 미등록"} · {new Date(row.created_at).toLocaleDateString("ko-KR")}</span>
    <p>{matching.length?"기존 명단이 있습니다. 학생과 반을 확인해 연결하세요.":"가입 완료 · 명단 미등록"}</p>
    <div className="actions">
      {matching.length>0&&<button type="button" className={mode==="existing"?"primary":"ghost"} onClick={()=>{setMode("existing");setConfirm(false);}}>기존 명단 연결</button>}
      <button type="button" className={mode==="new"?"primary":"ghost"} onClick={()=>{setMode("new");setConfirm(false);}}>신규 명단 등록</button>
    </div>
    {mode==="existing"?<label>연결할 기존 명단<select value={rosterId} onChange={e=>{setRosterId(e.target.value);setConfirm(false);}}><option value="">학생·학교·반을 확인해주세요</option>{matching.map(item=><option key={item.id} value={item.id}>{item.student_name} · {item.school_name} {item.grade} · {item.class_name}</option>)}</select></label>:
      <div className="form workspace-form"><p>학생이 입력한 내용을 확인하고 수정할 수 있습니다. 승인 시 명단 등록과 계정 연결이 함께 완료됩니다.</p>
        <label>다니는 반<input value={className} maxLength={120} onChange={e=>{setClassName(e.target.value);setConfirm(false);}} required/></label>
        <label>학교<input value={school} maxLength={120} onChange={e=>{setSchool(e.target.value);setConfirm(false);}}/></label>
        <label>학년<input value={grade} maxLength={30} onChange={e=>{setGrade(e.target.value);setConfirm(false);}}/></label>
        <fieldset><legend>사용 교재</legend>{books.map(book=><label className="workspace-check" key={book}><input type="checkbox" checked={selectedBooks.includes(book)} onChange={e=>{setSelectedBooks(current=>e.target.checked?[...current,book]:current.filter(value=>value!==book));setConfirm(false);}}/>{book}</label>)}</fieldset>
      </div>}
    {confirm?<div><p>신청자가 실제 재원생이고 위 명단 정보가 맞는지 확인했나요?</p><button type="button" className="primary" disabled={busy||!valid} onClick={()=>void decide(payload())}>확인했으며 승인</button><button type="button" className="ghost" disabled={busy} onClick={()=>setConfirm(false)}>취소</button></div>:
      <div className="actions"><button type="button" className="primary" disabled={busy||!valid} onClick={()=>setConfirm(true)}>{mode==="new"?"신규 명단 등록 후 승인":"명단 확인 후 승인"}</button><button type="button" className="ghost" disabled={busy} onClick={()=>void decide({id:row.id,approve:false})}>반려</button></div>}
  </article>;
}
export default function AcademyReview({refresh}:{refresh:()=>Promise<void>}){
  const [data,setData]=useState<ReviewData>({requests:[],roster:[],books:[]});
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{try{const response=await fetch("/api/academy/requests",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.message);setData(result);setError("");}catch(e){setError(e instanceof Error?e.message:"연결 신청을 불러오지 못했습니다.");}},[]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer);},[load]);
  async function decide(input:Decision){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/academy/requests",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.message);
      window.dispatchEvent(new Event("academy-reviewed"));
      await Promise.all([load(),refresh()]);
    }catch(e){setError(e instanceof Error?e.message:"처리 실패");}
    finally{setBusy(false);}
  }
  return <details id="academy-review" className="panel academy-review"><summary>🔔 학원 연결 신청 · {data.requests.length}건</summary>
    <p>담당 선생님 또는 전체관리자가 신원과 명단 정보를 확인한 뒤 승인합니다.</p>
    {error&&<p role="alert">{error}</p>}
    {data.requests.map(row=><ReviewItem key={row.id} row={row} roster={data.roster} books={data.books} busy={busy} decide={decide}/>)}
    {!data.requests.length&&!error&&<p>대기 중인 신청이 없습니다.</p>}
    <button type="button" className="ghost" disabled={busy} onClick={()=>void load()}>새로고침</button>
  </details>;
}
