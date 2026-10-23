"use client";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import "./member-account.css";
import AccountManagement from "./account-management";

async function api(url:string,body?:Record<string,unknown>) {
  const response=await fetch(url,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});
  const result=await response.json();if(!response.ok)throw new Error(result.message||"요청을 처리하지 못했습니다.");return result;
}
export function KakaoButton({link=false}:{link?:boolean}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[password,setPassword]=useState("");
  async function start(){setBusy(true);setMessage("");try{const result=await api("/api/auth/kakao/start",{intent:link?"link":"login",password});window.location.assign(result.url);}catch(e){setMessage(e instanceof Error?e.message:"연결 실패");setBusy(false);}}
  return <div className="member-provider">{link&&<label>현재 비밀번호 확인<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" maxLength={128}/></label>}<button type="button" className="kakao-button" disabled={busy} onClick={()=>void start()}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.5l-1 3.7 4.4-2.6 1.9.2c5.5 0 10-3.5 10-7.8S17.5 3 12 3Z"/></svg>{busy?"연결 중…":link?"기존 계정에 카카오 연결":"카카오로 가입 / 로그인"}</button>{message&&<p role="alert">{message}</p>}</div>;
}
export function IndependentSignup(){
  const [email,setEmail]=useState(""),[code,setCode]=useState(""),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");try{const r=await api("/api/auth/email",{action:sent?"verify":"send",email,code});if(sent)window.location.assign("/");else{setSent(true);setMessage(r.message);}}catch(e){setMessage(e instanceof Error?e.message:"인증 실패");}finally{setBusy(false);}}
  return <section className="member-signup"><h2>나만의 스터디결 시작하기</h2><p>가입 후 학습 유형과 학교를 선택합니다. 학원에는 자동 배정되지 않습니다.</p><KakaoButton/><div className="member-divider">또는</div><form className="form" onSubmit={submit}><label>이메일<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={sent} onChange={e=>setEmail(e.target.value)}/></label>{sent&&<label>이메일 인증번호<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,8}" maxLength={8} value={code} onChange={e=>setCode(e.target.value)}/></label>}<button className="primary" disabled={busy}>{busy?"확인 중…":sent?"인증하고 계속하기":"이메일로 가입 / 로그인"}</button>{sent&&<button type="button" className="ghost" onClick={()=>{setSent(false);setCode("");}}>이메일 변경 / 인증번호 재요청</button>}</form>{message&&<p role="status">{message}</p>}<small>신규 이메일 계정은 인증번호로 로그인합니다. 기존 이메일·비밀번호 로그인도 그대로 유지됩니다.</small></section>;
}
type Profile={id:string;display_name:string;learner_type:string;school:string;grade:string;major:string;onboarding_complete:boolean;academy_username:string|null};
type Account={profile:Profile|null;providers:string[];request:{status:string;student_name:string;teacher_name:string;school:string;grade:string;requested_class:string;requested_books:string[]}|null};
function ProfileForm({profile,onSaved}:{profile:Profile;onSaved:()=>void}){
  const [kind,setKind]=useState(profile.learner_type),[name,setName]=useState(profile.display_name),[school,setSchool]=useState(profile.school),[grade,setGrade]=useState(profile.grade),[major,setMajor]=useState(profile.major),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError("");try{await api("/api/account",{name,learnerType:kind,school,grade,major,acceptTerms:f.get("terms")==="on",acceptPrivacy:f.get("privacy")==="on",age14:f.get("age")==="on"});onSaved();}catch(e){setError(e instanceof Error?e.message:"저장 실패");}finally{setBusy(false);}}
  return <section className="panel member-onboarding"><span className="badge">스터디결 · 처음 시작하기</span><h2>어떤 공부를 하고 계신가요?</h2><p>내게 맞는 학습 공간을 준비할게요. 학교 정보를 입력해도 학원에 자동 가입되지 않아요.</p><form className="form" onSubmit={submit}><fieldset className="learner-types"><legend>학습 유형</legend>{[["school","중·고등학생"],["university","대학생·대학원생"],["general","일반 학습자"]].map(([v,label])=><label key={v} className={kind===v?"selected":""}><input type="radio" name="learner" value={v} checked={kind===v} onChange={()=>{setKind(v);setGrade("");}}/>{label}</label>)}</fieldset><label>{kind==="general"?"이름 또는 표시 이름":"이름"}<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>{kind!=="general"&&<><label>{kind==="university"?"대학교":"학교"}<input maxLength={120} value={school} onChange={e=>setSchool(e.target.value)} placeholder="학교 이름 직접 입력 · 미등록이면 비워두세요"/></label><label>학년<select required value={grade} onChange={e=>setGrade(e.target.value)}><option value="">선택해주세요</option>{(kind==="school"?["중1","중2","중3","고1","고2","고3","해당 없음"]:["1학년","2학년","3학년","4학년","5학년 이상","대학원","해당 없음"]).map(v=><option key={v}>{v}</option>)}</select></label></>}{kind==="university"&&<label>전공 (선택)<input maxLength={100} value={major} onChange={e=>setMajor(e.target.value)}/></label>}<label className="member-check"><input type="checkbox" name="age" required/>만 14세 이상입니다. 현재 신규 가입은 만 14세 이상을 대상으로 합니다.</label><label className="member-check"><input type="checkbox" name="terms" required/><a href="/terms" target="_blank" rel="noreferrer">이용약관</a>에 동의합니다.</label><label className="member-check"><input type="checkbox" name="privacy" required/><a href="/privacy" target="_blank" rel="noreferrer">개인정보 처리방침</a>을 확인하고 가입 정보 처리에 동의합니다.</label><button className="primary" disabled={busy}>{busy?"저장 중…":"내 학습 공간 시작하기"}</button>{error&&<p role="alert">{error}</p>}</form></section>;
}
function AcademyConnect({account,reload}:{account:Account;reload:()=>void}){
  const request=account.request;
  const [code,setCode]=useState("");
  const [name,setName]=useState(request?.student_name||account.profile?.display_name||"");
  const [teacher,setTeacher]=useState(request?.teacher_name||"");
  const [className,setClassName]=useState(request?.requested_class||"");
  const [school,setSchool]=useState(request?.school||account.profile?.school||"");
  const [grade,setGrade]=useState(request?.grade||account.profile?.grade||"");
  const [books,setBooks]=useState<string[]>(request?.requested_books||[]);
  const [catalog,setCatalog]=useState<string[]>([]);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{void api("/api/academy/requests").then(v=>setCatalog(v.books||[])).catch(()=>setMessage("교재 목록을 불러오지 못했습니다."));},[]);
  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try {
      if(request?.status==="pending") {
        const response=await fetch("/api/academy/requests",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({className,school,grade,books})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.message||"수정하지 못했습니다.");
        setMessage(result.message);
      } else {
        await api("/api/academy/requests",{code,studentName:name,teacher,className,school,grade,books});
        setCode("");setMessage("학원 연결 신청을 접수했습니다.");
      }
      reload();
    } catch(e){setMessage(e instanceof Error?e.message:"신청 실패");}
    finally{setBusy(false);}
  }
  async function enter(){setBusy(true);try{await api("/api/account",{action:"academy-enter"});window.location.assign("/");}catch(e){setMessage(e instanceof Error?e.message:"접속 실패");setBusy(false);}}
  const editable=!request||request.status==="pending"||request.status==="rejected";
  return <section className="panel"><h2>다니는 학원이 있나요?</h2>
    {account.profile?.academy_username?<><p>SG고등관 연결 승인 완료 · {account.profile.academy_username}</p><button type="button" className="primary" disabled={busy} onClick={()=>void enter()}>학원 학습 공간으로 이동</button><p>독립 계정의 과목·기록은 그대로 유지됩니다. 개인 공간으로 돌아오려면 독립 계정으로 다시 로그인하세요.</p></>:
    editable?<details><summary>{request?.status==="pending"?"SG고등관 연결 대기 · 신청 정보 수정":request?.status==="rejected"?"반려된 신청 수정 · 다시 신청하기":"학원 연결하기 (선택)"}</summary>
      <p>{request?.status==="pending"?"신청 정보는 승인 전까지 수정할 수 있습니다. 담당 선생님 또는 전체관리자가 명단을 확인합니다.":request?.status==="rejected"?"이전 신청이 반려됐습니다. 정보를 확인하고 초대코드를 다시 입력해주세요.":"초대코드는 신청용입니다. 승인 전에는 학원 자료에 접근할 수 없습니다."}</p>
      <p>기존 SG고등관 계정이 있다면 기존 계정으로 로그인한 뒤 카카오를 연결하세요. 이름만으로 기존 기록을 합치지 않습니다.</p>
      <form className="form" onSubmit={submit}>
        {request?.status!=="pending"&&<label>학원 초대코드<input type="password" required value={code} maxLength={128} onChange={e=>setCode(e.target.value)}/></label>}
        <label>명단에 등록된 학생 이름<input required maxLength={60} disabled={request?.status==="pending"} value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>담당 선생님<select required disabled={request?.status==="pending"} value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">선택해주세요</option>{["이주백.T","박병민.T","노대근.T"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>다니는 반<input required maxLength={120} value={className} onChange={e=>setClassName(e.target.value)} placeholder="예: 월금일 고1 내신심화반"/></label>
        <label>학교<input maxLength={120} value={school} onChange={e=>setSchool(e.target.value)}/></label>
        <label>학년<input maxLength={30} value={grade} onChange={e=>setGrade(e.target.value)}/></label>
        <fieldset><legend>사용 중인 교재</legend>{catalog.length?catalog.map(book=><label key={book} className="workspace-check"><input type="checkbox" checked={books.includes(book)} onChange={e=>setBooks(current=>e.target.checked?[...current,book]:current.filter(value=>value!==book))}/>{book}</label>):<p>선택 가능한 교재를 불러오는 중입니다.</p>}</fieldset>
        <button className="primary" disabled={busy||!className.trim()||!books.length}>{busy?"저장 중…":request?.status==="pending"?"신청 정보 수정":request?.status==="rejected"?"다시 신청":"연결 신청"}</button>
      </form></details>:<p role="status">연결 승인 완료 · {request?.teacher_name}</p>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
export function MemberGate({children,logout}:{children:ReactNode;logout:()=>void}){
  const [account,setAccount]=useState<Account|null>(null),[error,setError]=useState("");
  const reload=useCallback(()=>{void api("/api/account").then(a=>{setAccount(a);setError("");}).catch(e=>setError(e.message));},[]);
  useEffect(reload,[reload]);
  if(error)return <main className="shell"><section className="panel"><p role="alert">{error}</p><button className="ghost" onClick={reload}>다시 확인</button><button className="ghost" onClick={logout}>로그아웃</button></section></main>;
  if(!account)return <main className="shell"><p role="status">내 계정을 확인하고 있어요.</p></main>;
  if(!account.profile?.onboarding_complete)return <main className="shell"><button className="ghost" onClick={logout}>로그아웃</button>{account.profile&&<ProfileForm profile={account.profile} onSaved={reload}/>}</main>;
  return <>{children}<div className="shell member-settings"><AcademyConnect account={account} reload={reload}/><details className="panel"><summary>계정 관리</summary><AccountManagement logout={logout}/><details className="panel"><summary>가입 정보 수정</summary><ProfileForm profile={account.profile} onSaved={reload}/></details><section className="panel"><h2>로그인·보안</h2>{account.providers.includes("kakao")?<p>카카오 연결 완료</p>:<KakaoButton link/>}</section></details></div></>;
}
export function LegacyKakaoLink(){return <section className="panel"><h2>카카오로도 로그인하기</h2><p>현재 학생 계정에 연결합니다. 기존 비밀번호 로그인과 오답·출석 기록은 유지됩니다.</p><KakaoButton link/></section>;}
