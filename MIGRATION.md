# SG 오답노트 → 스터디결 웹 이전

운영 중인 Streamlit 앱은 그대로 두고, Next.js 앱이 같은 Supabase 프로젝트를 사용한다. 운영 데이터의 구조를 변경하거나 일괄 수정하지 않는다.

## 이번 단계에서 구현한 흐름

- 랜딩의 ‘지금 시작하기’ → 학생/선생님 로그인
- 기존 `users.password_hash` SHA-256 호환, 로그인 상태 복원
- 학생 회원가입 코드, 비밀번호 재설정 요청, 임시 비밀번호 변경
- 일반 오답 입력·목록·비고 수정·삭제, 저장 후 DB 재조회 검증
- X-패턴 4종의 학교별 offset 변환·원래 번호 표시
- 학교 기출 오답 입력·목록
- 선생님별 학생·오답·주간 제출·학교 기출·출력 현황·재설정 요청
- 명단의 쉼표 구분 복수 교재 매칭
- 전체 관리자 교재/학교 기출 등록 및 사용 상태, 공지, 명단 정보 수정

## 운영 투입 전에 남은 일

- Streamlit의 모든 출력용 Excel·PDF 생성, ZIP/PDF 업로드, 평가 결과 Excel 반영, AI 학습 상담, 학생 계정/오답 이전 기능 이전
- 실제 Supabase 스키마와 소수의 테스트 계정으로 권한·저장·출력 흐름 검증
- Vercel Production에 `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `SUPERADMIN_PASSWORD`, `STUDENT_SIGNUP_CODE` 추가. `SESSION_SECRET`, `SUPABASE_URL`은 추가됨
- Preview 환경에 필요한 값을 설정하고 배포 미리보기 검증
- 기능 비교 확인 후에만 `main`과 실제 주소에 반영

비밀값은 GitHub 파일이나 브라우저 클라이언트 코드에 넣지 않는다.
