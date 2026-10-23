"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountInfo = { role: "student" | "member"; name: string; loginId?: string; email?: string; phone: string; school: string; grade: string; className?: string; schoolEditable: boolean; academyConnected?: boolean };

export default function AccountManagement({ logout }: { logout: () => void }) {
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/management", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "계정 정보를 불러오지 못했습니다.");
      if (active) { setInfo(result); setPhone(result.phone || ""); setSchool(result.school || ""); setLoadError(""); }
    }).catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "계정 정보를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/management", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, ...(info?.schoolEditable ? { school } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "저장하지 못했습니다.");
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function withdraw(event: FormEvent) {
    event.preventDefault();
    if (confirmation !== "탈퇴") { setMessage("확인란에 ‘탈퇴’를 입력해주세요."); return; }
    if (!window.confirm("계정 이용을 중지하고 탈퇴 회원으로 옮길까요? 개인 기록은 1년간 보관하며, 만료 후 관리자가 확인해 삭제합니다.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account/management", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "탈퇴 처리에 실패했습니다.");
      logout();
    } catch (error) { setMessage(error instanceof Error ? error.message : "탈퇴 처리에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="panel"><h2>내 정보</h2>{!info ? <p role={loadError ? "alert" : "status"}>{loadError || "계정 정보를 불러오는 중입니다."}</p> : <>
      <div className="row"><strong>이름</strong><span>{info.name || "미설정"}</span></div>
      {info.loginId && <div className="row"><strong>로그인 아이디</strong><span>{info.loginId}</span></div>}
      {info.email && <div className="row"><strong>이메일</strong><span>{info.email}</span></div>}
      <div className="row"><strong>학교</strong><span>{info.school || "미등록"}{info.grade ? ` · ${info.grade}` : ""}</span></div>
      {info.className && <div className="row"><strong>학원 반</strong><span>{info.className}</span></div>}
      {!info.schoolEditable && <p>학원에 연결된 학교·반 정보는 명단 기준입니다. 변경이 필요하면 담당 선생님께 알려주세요.</p>}
      <form className="form workspace-form" onSubmit={save}>
        {info.schoolEditable && <label>학교<input value={school} maxLength={120} onChange={(event) => setSchool(event.target.value)} placeholder="학교 이름 (선택)" /></label>}
        <label>휴대전화 번호 (선택)<input type="tel" autoComplete="tel" inputMode="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01012345678" /><small>번호 인증 전에는 알림·본인 확인에 사용하지 않습니다.</small></label>
        <button className="primary" disabled={busy}>정보 저장</button>
      </form>
    </>}</section>
    {info && <section className="panel account-withdrawal"><details><summary>회원탈퇴</summary><p>탈퇴 즉시 로그인이 중지되고 ‘탈퇴 회원’으로 이동합니다. 휴대전화 번호는 즉시 지우며, 계정과 개인 오답·출석·학습 기록은 탈퇴일부터 1년간 보관합니다. 만료 후 관리자가 소유 기록을 확인해 삭제하며, 학원 명단은 학원 운영 자료로 별도 관리됩니다.</p><form className="form workspace-form" onSubmit={withdraw}><label>확인을 위해 ‘탈퇴’ 입력<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></label><label>현재 비밀번호{info.role === "member" && " (비밀번호 계정만)"}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required={info.role === "student"} /></label>{info.role === "member" && <small>카카오·이메일 인증 계정은 다시 로그인한 뒤 5분 안에 진행해주세요.</small>}<button type="submit" className="account-withdraw-button" disabled={busy || confirmation !== "탈퇴"}>회원탈퇴 진행</button></form></details></section>}
    {message && <p className="workspace-message" role="status">{message}</p>}
  </>;
}
