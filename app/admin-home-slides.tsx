"use client";

import { ChangeEvent, useEffect, useState } from "react";
import StudentNoticeCarousel, { StudentHomeSlide } from "./student-notice-carousel";
import { HomeSlide } from "../lib/home-slides";
import "./admin-operations.css";

type Row = { id: number; draft: HomeSlide; published: HomeSlide | null; display_order: number; is_active: boolean };
const empty: HomeSlide = { kind: "custom", title: "", description: "", eyebrow: "학원 소식" };
const localDate = (value?: string) => value ? new Date(value).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace(" ", "T") : "";
const imageUrl = (slide: HomeSlide) => slide.imagePath ? `/api/admin/home-slides/image?path=${encodeURIComponent(slide.imagePath)}` : slide.imageUrl || "";
const preview = (slide: HomeSlide): StudentHomeSlide => ({ id: "preview", kind: slide.kind, title: slide.title || "제목 미리보기", description: slide.description || "설명 미리보기", eyebrow: slide.eyebrow, image: imageUrl(slide), url: slide.linkUrl });
async function read(response: Response) { const result = await response.json(); if (!response.ok) throw new Error(result.message || "요청을 처리하지 못했습니다."); return result; }

export default function AdminHomeSlides() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<HomeSlide>(empty);
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = rows.find((row) => row.id === selected);
  async function reload(pick?: number) {
    const data = await read(await fetch("/api/admin/home-slides", { cache: "no-store" }));
    setRows(data.slides || []);
    if (pick !== undefined) setSelected(pick);
    else if (selected === null && data.slides?.length) { setSelected(data.slides[0].id); setDraft(data.slides[0].draft); }
    else if (selected !== null) setDraft((data.slides || []).find((item: Row) => item.id === selected)?.draft || empty);
  }
  useEffect(() => { void reload().catch((error) => setMessage(error.message)); }, []);
  function choose(row: Row) { setSelected(row.id); setDraft(row.draft); setMessage(""); }
  function set<K extends keyof HomeSlide>(key: K, value: HomeSlide[K]) { setDraft((before) => ({ ...before, [key]: value })); }
  async function act(action: string, direction?: "up" | "down") {
    setBusy(true); setMessage("");
    try {
      const data = await read(await fetch("/api/admin/home-slides", { method: selected === null ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected === null ? { draft } : { id: selected, action, draft, direction }) }));
      await reload(data.slide?.id);
      if (data.slide) setDraft(data.slide.draft);
      setMessage(action === "publish" ? "학생 화면에 게시했습니다." : action === "hide" ? "학생 화면에서 숨겼습니다." : "저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.append("file", file);
      const result = await read(await fetch("/api/admin/home-slides/image", { method: "POST", body: form }));
      setDraft((before) => ({ ...before, imagePath: result.imagePath, imageUrl: undefined }));
      setMessage("이미지를 올렸습니다. 게시를 누르면 학생 화면에 반영됩니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "이미지를 올리지 못했습니다."); }
    finally { setBusy(false); event.target.value = ""; }
  }
  return <section className="panel admin-operations">
    <h2>🖼️ 학생 홈 배너</h2><p>학생 화면에서 3초마다 넘어가는 배너를 관리합니다. 초안을 저장한 뒤 게시하면 학생에게 보입니다.</p>
    <div className="admin-operations-layout"><div className="admin-operations-list">
      <button type="button" className={selected === null ? "active" : ""} onClick={() => { setSelected(null); setDraft(empty); setMessage(""); }}>＋ 새 배너</button>
      {rows.map((row, index) => <div className="admin-operations-row" key={row.id}><button type="button" className={selected === row.id ? "active" : ""} onClick={() => choose(row)}><strong>{index + 1}. {row.draft.title}</strong><small>{row.is_active ? "게시 중" : row.published ? "숨김" : "초안"}{JSON.stringify(row.draft) !== JSON.stringify(row.published) && row.published ? " · 수정 중" : ""}</small></button><div><button type="button" disabled={busy || index === 0} onClick={() => { setSelected(row.id); void fetch("/api/admin/home-slides", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, action: "move", direction: "up" }) }).then(read).then(() => reload()).catch((error) => setMessage(error.message)); }} aria-label="앞으로 이동">↑</button><button type="button" disabled={busy || index === rows.length - 1} onClick={() => { setSelected(row.id); void fetch("/api/admin/home-slides", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, action: "move", direction: "down" }) }).then(read).then(() => reload()).catch((error) => setMessage(error.message)); }} aria-label="뒤로 이동">↓</button></div></div>)}
    </div><div className="admin-operations-editor">
      <div className="admin-operations-fields">
        <label>배너 종류<select value={draft.kind} onChange={(event) => set("kind", event.target.value as HomeSlide["kind"])}><option value="custom">이미지 배너</option><option value="blog">블로그 배너</option><option value="home">홈 화면 안내</option><option value="ai">AI 이용 안내</option></select></label>
        <label>작은 제목<input value={draft.eyebrow} onChange={(event) => set("eyebrow", event.target.value)} maxLength={40} /></label>
        <label>제목<input value={draft.title} onChange={(event) => set("title", event.target.value)} maxLength={120} /></label>
        <label>설명<textarea value={draft.description} onChange={(event) => set("description", event.target.value)} maxLength={600} rows={3} /></label>
        {(draft.kind === "custom" || draft.kind === "blog") && <label>이미지 (JPG·PNG·WEBP, 최대 3MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} /></label>}
        <label>자세히 보기 링크 (선택)<input type="url" placeholder="https://..." value={draft.linkUrl || ""} onChange={(event) => set("linkUrl", event.target.value)} /></label>
        <label>게시 시작 (선택)<input type="datetime-local" value={localDate(draft.startsAt)} onChange={(event) => set("startsAt", event.target.value ? new Date(event.target.value).toISOString() : undefined)} /></label>
        <label>게시 종료 (선택)<input type="datetime-local" value={localDate(draft.endsAt)} onChange={(event) => set("endsAt", event.target.value ? new Date(event.target.value).toISOString() : undefined)} /></label>
      </div>
      <div className="admin-operations-actions"><button type="button" disabled={busy} onClick={() => void act("save")}>초안 저장</button>{selected !== null && <><button type="button" className="primary" disabled={busy} onClick={() => void act("publish")}>학생 화면에 게시</button>{current?.is_active && <button type="button" disabled={busy} onClick={() => void act("hide")}>숨기기</button>}{current?.published && <button type="button" disabled={busy} onClick={() => void act("discard")}>게시본으로 되돌리기</button>}</>}</div>
      {message && <p role="status">{message}</p>}
      <div className="admin-preview-heading"><strong>학생 화면 미리보기</strong><div><button type="button" onClick={() => setMode("mobile")} aria-pressed={mode === "mobile"}>모바일</button><button type="button" onClick={() => setMode("desktop")} aria-pressed={mode === "desktop"}>PC</button></div></div>
      <div className={`admin-preview admin-preview-${mode}`}><StudentNoticeCarousel previewSlides={[preview(draft)]} showAI onOpenAI={() => {}} /></div>
    </div></div>
  </section>;
}
