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
