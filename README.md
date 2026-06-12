# 내부 예약 시스템 - Google Calendar 저장 버전

## 포함 기능
- 달력형 화면
- 날짜별 가능 / 완료 개수 표시
- 가능 시간 등록
- 예약 완료 / 다시 열기 / 삭제
- 모든 일정(가능/완료)이 Google Calendar에 직접 저장됨
- 가능 시간 등록 → "예약 가능 - 선생님" 일정 생성
- 예약 완료 → 같은 일정의 제목이 "예약 완료 - 선생님"으로 변경
- 다시 열기 → 제목이 다시 "예약 가능"으로 변경
- 삭제 → Google Calendar에서도 삭제
- 앱을 열면 Google Calendar에서 일정을 불러오므로 여러 명이 같은 화면을 공유 가능

## 테스트 로그인 비밀번호
1234

## GitHub 업로드
이 ZIP 압축을 풀고 아래 파일/폴더를 그대로 업로드하세요.

- index.html
- api/calendar.js
- package.json
- README.md

## Vercel 환경변수 설정
Vercel 프로젝트에서 Settings → Environment Variables에 아래 3개를 추가하세요.

GOOGLE_CLIENT_EMAIL = Google Cloud 서비스 계정 이메일
GOOGLE_PRIVATE_KEY = 서비스 계정 JSON 안의 private_key 전체
GOOGLE_CALENDAR_ID = 연동할 Google Calendar ID

## Google Cloud 설정 요약
1. Google Cloud Console에서 프로젝트 생성
2. Google Calendar API 활성화
3. 서비스 계정 생성
4. 서비스 계정 JSON 키 생성
5. JSON 안의 client_email, private_key를 Vercel 환경변수에 입력
6. Google Calendar에서 서비스 계정 이메일을 캘린더에 공유
7. 권한은 일정 변경 이상으로 설정

## 주의
- 이 앱이 만든 일정만 화면에 표시됩니다(구글 캘린더에서 직접 만든 일반 일정은 앱에 안 보임).
- 환경변수 설정 전에는 임시 모드로 동작하며, 이때 등록한 일정은 해당 브라우저에만 저장됩니다.
- 권한은 캘린더 공유 시 "일정 변경" 이상으로 설정해야 합니다.
