"use client";

type Course = { id: string; title: string; semester: string };
type Exam = { id: string; course_id: string; title: string; exam_date: string };
type Mistake = { id: string; course_id: string; reviewed: boolean };
type Destination = "courses" | "exams" | "mistakes" | "quiz" | "competition" | "python" | "map" | "lecture";

type Props = {
  learnerType: string;
  courses: Course[];
  exams: Exam[];
  mistakes: Mistake[];
  onNavigate: (destination: Destination) => void;
  onOpenMap: (courseId: string) => void;
};

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function UniversityHome({ learnerType, courses, exams, mistakes, onNavigate, onOpenMap }: Props) {
  const upcoming = exams
    .filter((exam) => exam.exam_date >= today())
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  const pending = mistakes.filter((mistake) => !mistake.reviewed);

  return <>
    <section className="panel university-dashboard-intro">
      <div><span className="badge">나의 학습 공간</span><h2>오늘은 어디서 이어서 공부할까요?</h2><p>과목을 중심으로 시험, 연습, 오답을 한곳에서 이어 보세요.</p></div>
      <button type="button" className="primary" onClick={() => onNavigate("map")}>학습 지도 보기 →</button>
    </section>

    <div className="university-focus-grid">
      <section className="panel university-focus-card"><span className="university-eyebrow">다가오는 시험</span>{upcoming.length ? <><h3>{upcoming[0].title}</h3><p>{courses.find((course) => course.id === upcoming[0].course_id)?.title || "내 과목"} · {upcoming[0].exam_date}</p></> : <><h3>등록된 일정이 없어요</h3><p>시험 날짜를 추가하면 여기에서 바로 확인할 수 있어요.</p></>}<button type="button" onClick={() => onNavigate("exams")}>시험 일정 보기 →</button></section>
      <section className="panel university-focus-card"><span className="university-eyebrow">오답 복습</span><h3>{pending.length ? `${pending.length}개를 다시 볼 차례예요` : "복습할 오답이 없어요"}</h3><p>틀린 이유를 적고, 다시 풀었다면 복습 완료로 표시하세요.</p><button type="button" onClick={() => onNavigate("mistakes")}>오답 복습하기 →</button></section>
    </div>

    <section className="panel university-course-section">
      <div className="university-section-heading"><div><span className="university-eyebrow">내 공간</span><h2>이번 학기 과목</h2></div><button type="button" className="ghost" onClick={() => onNavigate("courses")}>+ 과목 관리</button></div>
      {courses.length ? <div className="university-course-grid">{courses.map((course) => {
        const courseExams = exams.filter((exam) => exam.course_id === course.id).length;
        const coursePending = pending.filter((mistake) => mistake.course_id === course.id).length;
        return <button type="button" className="university-course-card" key={course.id} onClick={() => onOpenMap(course.id)}><span className="university-course-icon" aria-hidden="true">▦</span><strong>{course.title}</strong><small>{course.semester || "학기 미지정"}</small><span>시험 {courseExams} · 복습할 오답 {coursePending}</span><em>학습 지도 열기 →</em></button>;
      })}</div> : <div className="university-empty-course"><p>아직 등록한 과목이 없습니다. 첫 과목을 만들면 시험과 오답을 연결해 볼 수 있어요.</p><button type="button" className="primary" onClick={() => onNavigate("courses")}>첫 과목 등록하기</button></div>}
    </section>

    <section className="university-track-section"><div className="university-section-heading"><div><span className="university-eyebrow">바로 시작</span><h2>준비된 학습 콘텐츠</h2></div></div><div className="university-track-grid">{learnerType === "university" && <button type="button" className="university-track-card" onClick={() => onNavigate("lecture")}><span>과목별 강의 기록</span><strong>녹음하며 만드는 내 강의 노트</strong><small>받아쓰기 → 원문 확인 → 직접 정리</small><em>강의 노트 열기 →</em></button>}{learnerType === "university" && <button type="button" className="university-track-card university-competition-card" onClick={() => onNavigate("competition")}><span>대학생 공식 모의고사</span><strong>미적분학2 · 함께 실력 겨루기</strong><small>같은 문제 · 30분 · 1회 응시 · 종료 후 익명 순위</small><em>모의고사 보기 →</em></button>}<button type="button" className="university-track-card" onClick={() => onNavigate("python")}><span>기초프로그래밍2</span><strong>파이썬 1~7장</strong><small>요약 → 예제 → 직접 실행</small><em>연습실 열기 →</em></button><button type="button" className="university-track-card" onClick={() => onNavigate("quiz")}><span>미적분학2</span><strong>시험형 변형 퀴즈</strong><small>3세트 → 정답 → 풀이 확인</small><em>퀴즈 풀기 →</em></button></div></section>
  </>;
}

type MapProps = Omit<Props, "onOpenMap" | "learnerType"> & {
  selectedCourseId: string;
  onSelectCourse: (id: string) => void;
};

export function UniversityStudyMap({ courses, exams, mistakes, onNavigate, selectedCourseId, onSelectCourse }: MapProps) {
  const course = courses.find((item) => item.id === selectedCourseId) || courses[0];
  if (!course) return <section className="panel university-map-empty"><span className="badge">학습 지도</span><h2>과목을 등록하면 연결 지도가 만들어집니다.</h2><p>과목에 시험 일정과 오답을 연결해 학습 흐름을 한눈에 볼 수 있어요.</p><button type="button" className="primary" onClick={() => onNavigate("courses")}>과목 등록하기</button></section>;

  const courseExams = exams.filter((exam) => exam.course_id === course.id).sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  const courseMistakes = mistakes.filter((mistake) => mistake.course_id === course.id);
  const pending = courseMistakes.filter((mistake) => !mistake.reviewed);
  return <section className="panel university-map-section"><div className="university-section-heading"><div><span className="university-eyebrow">과목별 학습 지도</span><h2>내 공부의 연결을 한눈에</h2><p>지금 등록된 시험·오답을 과목에 연결했습니다.</p></div><label>과목 선택<select value={course.id} onChange={(event) => onSelectCourse(event.target.value)}>{courses.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label></div>
    <div className="university-map" aria-label={`${course.title} 학습 지도`}><div className="university-map-core"><span>이번 학기 과목</span><strong>{course.title}</strong><small>{course.semester || "학기 미지정"}</small></div><div className="university-map-branches"><button type="button" className="university-map-node" onClick={() => onNavigate("exams")}><span>시험 준비</span><strong>{courseExams.length}개 일정</strong><small>{courseExams[0] ? `${courseExams[0].title} · ${courseExams[0].exam_date}` : "시험 일정 등록하기"}</small></button><button type="button" className="university-map-node" onClick={() => onNavigate("mistakes")}><span>오답 복습</span><strong>{pending.length}개 남음</strong><small>전체 기록 {courseMistakes.length}개</small></button><button type="button" className="university-map-node" onClick={() => onNavigate("courses")}><span>과목 관리</span><strong>학습 내용 이어가기</strong><small>과목 정보와 학기 확인</small></button></div></div>
    {courseMistakes.length > 0 && <p className="university-map-footer">복습 완료 {courseMistakes.length - pending.length}개 · 아직 복습할 오답 {pending.length}개</p>}
  </section>;
}

