export type AdmissionGroup = "수도권 주요 대학" | "국숭세단·광명상가" | "지역 대학";

export type AdmissionUniversity = {
  name: string;
  group: AdmissionGroup;
  region: string;
  note?: string;
  verified2027Code?: string;
};

// This is a discovery list, not a table of admissions results or verified majors.
export const ADMISSION_UNIVERSITIES: AdmissionUniversity[] = [
  { name: "서울대학교", group: "수도권 주요 대학", region: "서울", verified2027Code: "0000019" },
  { name: "연세대학교", group: "수도권 주요 대학", region: "서울", note: "미래캠퍼스는 별도 전형입니다.", verified2027Code: "0000149" },
  { name: "고려대학교", group: "수도권 주요 대학", region: "서울", note: "캠퍼스별 전형을 확인하세요.", verified2027Code: "0000069" },
  { name: "서강대학교", group: "수도권 주요 대학", region: "서울", verified2027Code: "0000120" },
  { name: "성균관대학교", group: "수도권 주요 대학", region: "서울·경기", verified2027Code: "0000133" },
  { name: "한양대학교", group: "수도권 주요 대학", region: "서울", note: "ERICA캠퍼스는 별도 전형입니다.", verified2027Code: "0000203" },
  { name: "중앙대학교", group: "수도권 주요 대학", region: "서울·경기", verified2027Code: "0000175" },
  { name: "경희대학교", group: "수도권 주요 대학", region: "서울·경기", verified2027Code: "0000066" },
  { name: "한국외국어대학교", group: "수도권 주요 대학", region: "서울·경기", verified2027Code: "0000192" },
  { name: "서울시립대학교", group: "수도권 주요 대학", region: "서울", verified2027Code: "0000040" },
  { name: "건국대학교", group: "수도권 주요 대학", region: "서울", note: "글로컬캠퍼스는 별도 전형입니다.", verified2027Code: "0000052" },
  { name: "동국대학교", group: "수도권 주요 대학", region: "서울", note: "WISE캠퍼스는 별도 전형입니다.", verified2027Code: "0000100" },
  { name: "홍익대학교", group: "수도권 주요 대학", region: "서울·세종", note: "서울·세종캠퍼스의 모집단위를 구분하세요.", verified2027Code: "0000212" },
  { name: "숙명여자대학교", group: "수도권 주요 대학", region: "서울", verified2027Code: "0000141" },
  { name: "인하대학교", group: "수도권 주요 대학", region: "인천", verified2027Code: "0000169" },
  { name: "아주대학교", group: "수도권 주요 대학", region: "경기", verified2027Code: "0000146" },
  { name: "국민대학교", group: "국숭세단·광명상가", region: "서울", verified2027Code: "0000078" },
  { name: "숭실대학교", group: "국숭세단·광명상가", region: "서울", verified2027Code: "0000143" },
  { name: "세종대학교", group: "국숭세단·광명상가", region: "서울", verified2027Code: "0000138" },
  { name: "단국대학교", group: "국숭세단·광명상가", region: "경기·충남", note: "죽전·천안캠퍼스를 구분하세요.", verified2027Code: "0000082" },
  { name: "광운대학교", group: "국숭세단·광명상가", region: "서울", verified2027Code: "0000074" },
  { name: "명지대학교", group: "국숭세단·광명상가", region: "서울·경기", note: "인문·자연캠퍼스 모집단위를 구분하세요.", verified2027Code: "0000109" },
  { name: "상명대학교", group: "국숭세단·광명상가", region: "서울·충남", note: "서울·천안캠퍼스를 구분하세요.", verified2027Code: "0000117" },
  { name: "가톨릭대학교", group: "국숭세단·광명상가", region: "서울·경기", verified2027Code: "0000046" },
  { name: "부산대학교", group: "지역 대학", region: "부산·경남", verified2027Code: "0000014" },
  { name: "경북대학교", group: "지역 대학", region: "대구·경북", verified2027Code: "0000005" },
  { name: "경상국립대학교", group: "지역 대학", region: "경남", verified2027Code: "0000007" },
  { name: "충남대학교", group: "지역 대학", region: "대전", verified2027Code: "0000029" },
  { name: "충북대학교", group: "지역 대학", region: "충북", verified2027Code: "0000030" },
  { name: "전남대학교", group: "지역 대학", region: "광주·전남", verified2027Code: "0000024" },
  { name: "전북대학교", group: "지역 대학", region: "전북", verified2027Code: "0000025" },
  { name: "강원대학교", group: "지역 대학", region: "강원", note: "캠퍼스별 모집단위를 확인하세요.", verified2027Code: "0000003" },
  { name: "제주대학교", group: "지역 대학", region: "제주", verified2027Code: "0000027" },
  { name: "부경대학교", group: "지역 대학", region: "부산", verified2027Code: "0000013" },
  { name: "울산대학교", group: "지역 대학", region: "울산", verified2027Code: "0000158" },
  { name: "동아대학교", group: "지역 대학", region: "부산", verified2027Code: "0000105" },
  { name: "국립한국해양대학교", group: "지역 대학", region: "부산", verified2027Code: "0000033" },
];

export const ADMISSION_SOURCES = {
  year2027: "https://www.adiga.kr/ucp/prc/uni/admssUnivView.do?menuId=PCPRC",
  year2028: "https://www.adiga.kr/uct/ces/archiveView.do?menuId=PCUCTCES1000&prtlBbsId=25989",
  scoreAnalysis: "https://www.adiga.kr/",
  reform: "https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=97551&lev=0&m=020402&opType=N&s=moe",
};

export function official2027UniversityUrl(code: string) {
  return `https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=${encodeURIComponent(code)}`;
}

