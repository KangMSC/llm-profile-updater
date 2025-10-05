# Gemini CLI Project Log

## 2025년 10월 5일

- 프로젝트 시작
- `project-log.md` 생성
- 프로젝트 상태 파악
- `src/db.js`의 `getActorUUID` 함수에서 발생하는 숫자 정밀도 손실 버그 수정.
  - 원인: JavaScript의 `Number.MAX_SAFE_INTEGER`를 초과하는 `uuid` 값을 숫자로 처리하려다 발생.
  - 해결: SQL 쿼리에서 `CAST(uuid AS TEXT)`를 사용하여 `uuid`를 문자열로 가져오도록 수정.

---

## 프로젝트 분석 (2025-10-05)

### 1. 프로젝트 목적
- Skyrim 게임 내 캐릭터의 '기억(memories)' 데이터를 기반으로, LLM(AI 모델)을 사용하여 캐릭터의 성격, 최근 경험, 관계 등을 요약한 상세 프로필을 자동으로 생성하고 업데이트하는 Node.js 애플리케이션.

### 2. 핵심 동작 흐름
1.  `.env` 파일에 정의된 캐릭터 목록(`CHARACTER_NAMES`)을 읽어옴.
2.  각 캐릭터에 대해 SQLite 데이터베이스에 연결하여 고유 ID(`uuid`)와 기억 목록(`memories`)을 조회.
3.  조회된 기억들을 OpenRouter API를 통해 LLM에게 전달.
4.  LLM은 기억들을 바탕으로 새로운 캐릭터 프로필을 생성.
5.  생성된 프로필을 콘솔에 출력.

### 3. 주요 구성 요소
-   **`main.js`**: 전체 작업을 조율하는 메인 로직.
-   **`db.js`**: SQLite 데이터베이스 연결 및 데이터 조회/수정 담당.
-   **`llm.js`**: OpenRouter API와 통신하여 LLM을 통해 프로필 생성을 요청.
-   **`config.js`**: `.env` 파일에서 API 키, DB 경로 등 환경 변수를 불러와 관리.
-   **`db/schema.sql`**: `memories`, `events`, `uuid_mappings` 등 데이터베이스의 전체 테이블 구조를 정의.

### 4. 설정 (`.env` 파일)
-   `OPENROUTER_API_KEY`: OpenRouter API 사용을 위한 필수 키.
-   `DATABASE_PATH`: SQLite 데이터베이스 파일의 경로.
-   `CHARACTER_NAMES`: 프로필을 업데이트할 캐릭터 이름 목록 (쉼표로 구분).

### 5. 현 상태 및 다음 단계
-   현재 캐릭터의 기억을 읽어와 LLM을 통해 새 프로필을 생성하고 콘솔에 출력하는 기능까지 구현되어 있음.
-   `main.js`에 `// TODO: Save the new profile to the database` 주석이 명시된 바와 같이, 생성된 프로필을 다시 데이터베이스에 저장하는 기능이 구현되어야 함.

---

## 2025년 10월 5일 (오후) - 주요 기능 추가 및 버그 수정

### 기능 추가 및 변경사항
1.  **프로필 관리 시스템 개편**:
    -   LLM이 단순 텍스트 프로필을 생성하던 방식에서, 캐릭터별 `json` 파일을 읽고 최신 기억에 따라 내용을 "업데이트"하는 방식으로 변경.
    -   `profiles` 디렉토리를 추가하여 캐릭터의 `json` 프로필을 관리.

2.  **HTML 웹 인터페이스 구현**:
    -   업데이트된 프로필을 보여주는 정적 HTML 웹페이지를 생성하는 기능 추가.
    -   `public` 디렉토리에 각 캐릭터의 상세 페이지(`<캐릭터명>.html`)와 전체 목록 페이지(`index.html`)가 생성됨.
    -   `public/style.css`를 추가하여 기본적인 웹페이지 스타일링 적용.

3.  **웹 서버 추가**:
    -   `server.js` 파일을 추가하여 `public` 디렉토리의 HTML 파일들을 서비스하는 간단한 Node.js 웹 서버를 구현.
    -   `package.json`에 `npm start`로 서버를 실행할 수 있는 스크립트 추가.

4.  **LLM 설정 및 프롬프트 개선**:
    -   LLM 모델을 `.env` 파일에서 설정(`LLM_MODEL`)할 수 있도록 `config.js`와 `llm.js` 수정.
    -   LLM이 항상 한국어로 응답하고, 주어진 JSON 구조에 맞춰 결과물을 반환하도록 프롬프트를 대폭 수정.

### 버그 수정
1.  **`[object Object]` 표시 오류**: 웹페이지에서 `likesAndDislikes` 항목이 객체 형태로 되어 있을 경우, 내용 대신 `[object Object]`로 표시되던 문제를 해결. (`src/main.js`)
2.  **한글 파일명 404 오류**: `신미어` 등 한글 이름으로 된 캐릭터 페이지에 접근 시 404 Not Found가 발생하던 문제를 해결. URL 인코딩을 디코딩하도록 웹 서버 로직 수정. (`server.js`)
3.  **파일 손상 오류**: 이전 작업 중 `src/llm.js` 파일 내용이 손상되었던 문제를 복구.