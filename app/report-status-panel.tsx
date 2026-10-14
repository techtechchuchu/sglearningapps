import { buildReportStatus, type ReportStatusRow } from "../lib/report-status";

type Row = Record<string, any>;

function uniqueStudents(rows: ReportStatusRow[]) {
  return new Set(rows.map((row) => row.student)).size;
}

function date(value: string) {
  if (!value || value === "-") return "-";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed) : value;
}

function StatusTable({ rows, columns, empty }: { rows: ReportStatusRow[]; columns: Array<[string, (row: ReportStatusRow) => string | number]>; empty: string }) {
  if (!rows.length) return <p className="report-status-empty">{empty}</p>;
  return <div className="report-status-scroll"><table className="report-status-table"><thead><tr>{columns.map(([label]) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.teacher}|${row.className}|${row.student}|${index}`}>{columns.map(([label, value]) => <td key={label}>{value(row)}</td>)}</tr>)}</tbody></table></div>;
}

const personColumns: Array<[string, (row: ReportStatusRow) => string | number]> = [["담당선생님", (row) => row.teacher], ["반", (row) => row.className], ["학생", (row) => row.student]];

export default function ReportStatusPanel({ roster, answers, reports }: { roster: Row[]; answers: Row[]; reports: Row[] }) {
  const status = buildReportStatus(roster, answers, reports);
  return <section className="panel report-status-panel">
    <h2>📌 최신 보고서 기준 현황</h2>
    <p>가장 최근에 저장된 선생님별 보고서를 기준으로 배부 대상, 마감 후 새로 제출한 학생, 수요일 이후 제출 현황을 구분합니다.</p>
    {!status.reportCount && <p className="report-status-empty">저장된 보고서가 없어 배부·다음 전달·미작성 대상을 아직 계산할 수 없습니다.</p>}
    <div className="metrics report-status-metrics"><article><span>📦 이번 배부 대상</span><b>{uniqueStudents(status.delivered)}</b></article><article><span>🟠 다음 전달 대상</span><b>{uniqueStudents(status.next)}</b></article><article><span>🟣 수요일 이후 미작성</span><b>{uniqueStudents(status.missing)}</b></article></div>
    <details><summary>📦 최신 보고서 배부 대상 · {uniqueStudents(status.delivered)}명</summary><p>가장 최근 보고서에 들어간 학생입니다. 현재 오답노트를 배부해야 하는 명단으로 봅니다.</p><StatusTable rows={status.delivered} columns={[...personColumns, ["교재", (row) => row.book], ["문항수", (row) => row.count], ["제출마감", (row) => row.cutoff]]} empty="이번 배부 대상이 없습니다." /></details>
    <details><summary>🟠 다음 전달 대상 · {uniqueStudents(status.next)}명</summary><p>최신 보고서 마감 이후 오답을 제출했지만, 아직 그 학생의 오답노트가 다음 보고서에 생성되지 않은 상태입니다.</p><StatusTable rows={status.next} columns={[...personColumns, ["교재", (row) => row.book], ["문항수", (row) => row.count], ["마감후첫제출", (row) => date(row.first)], ["최근제출", (row) => date(row.latest)], ["추천전달일", (row) => row.suggestedDate]]} empty="다음 전달 대상이 없습니다." /></details>
    <details><summary>🟢 수요일 이후 작성 학생 · {uniqueStudents(status.submitted)}명</summary><p>가장 최근 수요일 00:00부터 현재까지 오답을 작성한 재원생입니다.</p><StatusTable rows={status.submitted} columns={[...personColumns, ["교재", (row) => row.book], ["문항수", (row) => row.count], ["첫제출", (row) => date(row.first)], ["최근제출", (row) => date(row.latest)]]} empty="지난 수요일 이후 작성한 학생이 없습니다." /></details>
    <details><summary>🟣 수요일 이후 미작성 학생 · {uniqueStudents(status.missing)}명</summary><p>가장 최근 수요일 00:00부터 현재 시각까지 오답을 한 번도 작성하지 않은 재원생입니다. 학생이 제출하면 새로고침 시 목록에서 제외됩니다.</p><StatusTable rows={status.missing} columns={[...personColumns, ["학교", (row) => row.school], ["학년", (row) => row.grade], ["최근제출", (row) => row.latest], ["미작성기간", (row) => row.window]]} empty="지난 수요일 이후 미작성 학생이 없습니다." /></details>
  </section>;
}

