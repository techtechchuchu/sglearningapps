// Class recordings shown in the student "수업 영상" menu.
// Add a new recording by appending one entry; youtubeId is the 11 characters after https://youtu.be/.
export type ClassVideo = {
  youtubeId: string;
  session: string;
  subject: string;
  school: string;
  date: string;
  teacher: string;
  // Problems explained in this recording, in the order they are taught. start is seconds from the beginning.
  problems: Array<{ number: number; start: number }>;
};

export const CLASS_VIDEOS: ClassVideo[] = [
  {
    youtubeId: "Ikz1vGLsVhA", session: "09회차", subject: "미적분1", school: "25 달천고", date: "2026-11-17", teacher: "이주백T",
    problems: [
      { number: 4, start: 77 },
      { number: 8, start: 145 },
      { number: 7, start: 338 },
      { number: 16, start: 437 },
      { number: 18, start: 627 },
      { number: 20, start: 834 },
      { number: 21, start: 918 },
      { number: 22, start: 1132 },
    ],
  },
];

export function classVideoTitle(video: ClassVideo) {
  return `${video.subject} · ${video.school} · ${video.session}`;
}

// "달천고등학교" on the roster should match a recording labelled "25 달천고".
export function classVideoMatchesSchool(video: ClassVideo, schoolName: string) {
  const short = String(schoolName || "").replace(/\s+/g, "").replace(/등학교$/, "");
  return short.length >= 2 && video.school.replace(/\s+/g, "").includes(short);
}

// Newest first, with the student's own school ahead of the others.
export function sortClassVideos(videos: ClassVideo[], studentSchools: string[]) {
  const mine = (video: ClassVideo) => studentSchools.some((name) => classVideoMatchesSchool(video, name));
  return [...videos].sort((a, b) => Number(mine(b)) - Number(mine(a)) || b.date.localeCompare(a.date) || b.session.localeCompare(a.session));
}
