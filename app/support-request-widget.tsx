"use client";

import { FormEvent, useEffect, useState } from "react";

type Attachment = { id: string; request_id: string; file_name: string; content_type: string; created_at: string };
type SupportItem = { id: string; message: string; status: "open" | "replied"; admin_reply: string | null; created_at: string; replied_at: string | null; attachments: Attachment[] };
const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const maxUploadSize = 4 * 1024 * 1024;

async function prepareFile(file: File): Promise<File> {
  if (file.size <= maxUploadSize) return file;
  if (!file.type.startsWith("image/")) throw new Error("PDF 파일은 4MB 이하로 선택해주세요.");
  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size > maxUploadSize) throw new Error("사진 크기를 줄이지 못했습니다.");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { throw new Error("사진 용량을 줄이지 못했습니다. 4MB 이하의 사진이나 화면 캡처를 선택해주세요."); }
}

export default function SupportRequestWidget({ fixedFooter = false }: { fixedFooter?: boolean }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<SupportItem[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    void fetch("/api/support/requests?mine=1", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "문의를 불러오지 못했습니다."); return data; })
      .then((data) => { if (live) setItems(data.requests || []); })
      .catch((error) => { if (live) setNotice(error instanceof Error ? error.message : "문의를 불러오지 못했습니다."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open]);

  async function uploadFile(requestId: string, file: File) {
    const ready = await prepareFile(file);
    const form = new FormData();
    form.set("requestId", requestId);
    form.set("file", ready);
    const response = await fetch("/api/support/attachments", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "파일을 첨부하지 못했습니다.");
    const attachment = data.attachment as Attachment;
    setItems((previous) => previous.map((item) => item.id === requestId ? { ...item, status: "open", attachments: [...(item.attachments || []), attachment] } : item));
  }

  async function uploadExisting(requestId: string, file?: File) {
    if (!file || uploadingId) return;
    setUploadingId(requestId); setNotice("");
    try { await uploadFile(requestId, file); setNotice("파일을 첨부했습니다. 관리자가 확인할 수 있습니다."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "파일을 첨부하지 못했습니다."); }
    finally { setUploadingId(""); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || message.trim().length < 10) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/support/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "문의를 접수하지 못했습니다.");
      setItems((previous) => [{ ...data.request, attachments: [] }, ...previous]);
      setMessage("");
      if (selectedFile) {
        try { await uploadFile(data.request.id, selectedFile); setSelectedFile(null); }
        catch (error) { setNotice(`문의는 접수됐지만 파일은 첨부되지 않았습니다. 아래 문의 내역에서 다시 첨부해주세요. ${error instanceof Error ? error.message : ""}`); return; }
      }
      setNotice("문의가 접수되었습니다. 근무시간에 확인 후 답변드리겠습니다.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "문의를 접수하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <>
    {fixedFooter ? <footer className="sg-contact-footer" aria-label="스터디결 이용 문의"><span>스터디결 이용 중 도움이 필요하신가요?</span><button type="button" className="sg-contact-ai-only" onClick={() => setOpen(true)}>관리자 상담 요청</button></footer> : <button type="button" className="support-request-trigger" onClick={() => setOpen(true)}>관리자 상담 요청</button>}
    {open && <div className="support-request-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="support-request-dialog" role="dialog" aria-modal="true" aria-labelledby="support-request-heading">
        <header><h2 id="support-request-heading">관리자 상담 요청</h2><button type="button" onClick={() => setOpen(false)} aria-label="닫기">×</button></header>
        <p>안녕하세요. 스터디결 관리자입니다. 문의사항을 남겨주시면 근무시간에 확인하는 대로 답변드리겠습니다.</p>
        <p className="support-request-hours">근무시간 · 평일 오전 10시~오후 5시</p>
        <form onSubmit={(event) => void submit(event)}><label htmlFor="support-request-message">문의 내용</label><textarea id="support-request-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2000} placeholder="어떤 점이 불편한지 적어주세요. 비밀번호나 인증번호는 입력하지 마세요." required /><div className="support-file-actions"><label className="support-file-action">📷 사진 촬영<input type="file" accept="image/*" capture="environment" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} /></label><label className="support-file-action">📎 파일 선택<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} /></label></div>{selectedFile && <small>첨부 예정: {selectedFile.name} (큰 사진은 자동으로 줄여 전송)</small>}<button type="submit" disabled={busy || message.trim().length < 10}>{busy ? "접수 중…" : "문의 남기기"}</button></form>
        {notice && <p className="support-request-notice" role="status">{notice}</p>}
        <h3>내 문의 내역</h3>
        {loading ? <p>불러오는 중…</p> : items.length ? <div className="support-request-list">{items.map((item) => <article key={item.id}><small>{dateTime(item.created_at)} · {item.status === "replied" ? "답변 완료" : "답변 대기"}</small><p>{item.message}</p>{item.attachments?.map((file) => <a className="support-attachment-link" href={`/api/support/attachments/${file.id}`} target="_blank" rel="noopener noreferrer" key={file.id}>📎 {file.file_name}</a>)}{item.admin_reply && <div><strong>관리자 답변</strong><p>{item.admin_reply}</p></div>}<div className="support-file-actions"><label className="support-file-action">📷 사진 추가<input type="file" accept="image/*" capture="environment" disabled={!!uploadingId} onChange={(event) => { void uploadExisting(item.id, event.target.files?.[0]); event.target.value = ""; }} /></label><label className="support-file-action">📎 파일 추가<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" disabled={!!uploadingId} onChange={(event) => { void uploadExisting(item.id, event.target.files?.[0]); event.target.value = ""; }} /></label></div>{uploadingId === item.id && <small>파일 첨부 중…</small>}</article>)}</div> : <p>아직 남긴 문의가 없습니다.</p>}
      </section>
    </div>}
  </>;
}
