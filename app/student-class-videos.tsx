"use client";

import { useState } from "react";
import { CLASS_VIDEOS, classVideoMatchesSchool, classVideoTitle, sortClassVideos } from "../lib/class-videos";
import { formatYoutubeStart, youtubeEmbedUrl } from "../lib/problem-explanations";

function displayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(parsed);
}

export default function StudentClassVideos({ studentSchools }: { studentSchools: string[] }) {
  const videos = sortClassVideos(CLASS_VIDEOS, studentSchools);
  const [selectedId, setSelectedId] = useState(videos[0]?.youtubeId || "");
  const [problem, setProblem] = useState<number | null>(null);
  const selected = videos.find((video) => video.youtubeId === selectedId) || videos[0];
  const start = selected?.problems.find((item) => item.number === problem)?.start ?? null;

  return <section className="panel problem-browser">
    <h2>수업 영상</h2><p>수업을 고른 뒤 문제번호를 누르면 그 문제 풀이가 시작되는 부분부터 재생됩니다.</p>
    {!selected ? <p className="problem-browser-note">아직 등록된 수업 영상이 없습니다.</p> : <>
      <div className="problem-detail">
        <div className="problem-detail-heading"><h3><span>{classVideoTitle(selected)}</span> <small>{displayDate(selected.date)} · {selected.teacher}</small></h3></div>
        {selected.problems.length > 0 && <div className="problem-number-grid" role="group" aria-label="문제번호로 이동">{selected.problems.map((item) => <button type="button" key={item.number} className={`problem-number${problem === item.number ? " selected" : ""}`} aria-pressed={problem === item.number} aria-label={`${item.number}번, ${formatYoutubeStart(item.start)}부터 재생`} onClick={() => setProblem(item.number)}>
          <span className="problem-number-play" aria-hidden="true">▶</span>
          <span className="problem-number-value">{item.number}</span>
        </button>)}</div>}
        <div className="problem-video"><iframe key={`${selected.youtubeId}:${start ?? 0}`} title={`${classVideoTitle(selected)} 수업 영상${problem && start ? ` ${problem}번 (${formatYoutubeStart(start)}부터)` : ""}`} src={`${youtubeEmbedUrl(selected.youtubeId, start)}${start ? "&autoplay=1" : ""}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
      </div>
      <div className="class-video-list" role="group" aria-label="수업 영상 목록">{videos.map((video) => {
        const mine = studentSchools.some((name) => classVideoMatchesSchool(video, name));
        return <button type="button" key={video.youtubeId} className={`class-video-item${video.youtubeId === selected.youtubeId ? " selected" : ""}`} aria-pressed={video.youtubeId === selected.youtubeId} onClick={() => { setSelectedId(video.youtubeId); setProblem(null); }}>
          <span className="class-video-play" aria-hidden="true">▶</span>
          <span className="class-video-text"><strong>{classVideoTitle(video)}</strong><small>{displayDate(video.date)} · {video.teacher}{mine ? " · 우리 학교" : ""}</small></span>
        </button>;
      })}</div>
    </>}
  </section>;
}
