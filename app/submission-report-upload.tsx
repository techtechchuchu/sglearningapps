"use client";

import { useState } from "react";

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await loading.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return pages.join("\n");
  } finally {
    await loading.destroy();
  }
}

export default function SubmissionReportUpload({ refresh }: { refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    const outcomes: string[] = [];
    for (const file of Array.from(files)) {
      try {
        if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDF 파일만 선택할 수 있습니다.");
        if (file.size > 200 * 1024 * 1024) throw new Error("파일당 최대 200MB입니다.");
        const text = await extractPdfText(file);
        const response = await fetch("/api/staff/submission-reports", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, text }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "저장 실패");
        outcomes.push(`${file.name}: 저장·검증 완료`);
      } catch (error) {
        outcomes.push(`${file.name}: ${error instanceof Error ? error.message : "처리 실패"}`);
      }
    }
    await refresh().catch(() => outcomes.push("목록 새로고침 실패"));
    setMessage(outcomes.join(" / "));
    setBusy(false);
  }

  return <section className="panel">
    <h2>📄 오답 제출 보고서 PDF 업로드</h2>
    <p>기존 보고서의 담당 선생님과 제출 기준 시각을 읽어 저장합니다. 원본 PDF는 서버에 저장하지 않습니다.</p>
    <label>보고서 PDF 선택<input type="file" accept="application/pdf,.pdf" multiple disabled={busy} onChange={(event) => void upload(event.target.files)} /></label>
    {busy && <p role="status">보고서를 읽고 저장 결과를 확인하는 중입니다.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
