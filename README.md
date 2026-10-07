# 구인 메일 Agent — 대시보드 (job_dashboard)

[`job_email_agent`](https://github.com/yahokim2/job_email_agent)가 메일에서 수집·구조화해 PostgreSQL(pgvector)에 쌓은 구인 공고를 **조회하고 관리하는 웹 대시보드**입니다. Next.js(TypeScript)로 만들었고, 공고 목록·상태 관리·삭제와 RAG 기반 질의응답 챗봇을 제공합니다.

## 주요 기능

- **공고 목록**: 최신순 최대 200건. 예상금액, 근무위치, 시작일·기간, 스킬, 모집 종료 여부와 공고 링크 표시
- **상태 관리**: 카드의 `관심` / `보류` / `거절` 버튼으로 상태를 저장 (화면은 먼저 갱신하고 서버에 반영)
- **삭제**: 목록에서 공고를 숨깁니다. 행을 지우지 않는 **소프트 삭제**(`deleted_at`)라서, 같은 메일을 다시 처리해도 삭제한 공고가 되살아나지 않습니다.
- **챗봇**: "여의도 Java 프로젝트 있어?" 같은 자연어 질문에 저장된 공고를 근거로 답변

### 챗봇 동작 순서

1. 질문을 Voyage AI(`voyage-4-lite`, 512차원)로 임베딩 (REST API 직접 호출)
2. pgvector에서 코사인 유사도 상위 **5건** 검색 (삭제한 공고 제외)
3. 검색된 공고만 근거로 Claude가 답변 생성. 목록에 없으면 "검색된 공고(최대 5건) 중에는 없습니다"라고 답하도록 규칙 지정
4. 마크다운·이모지를 서버에서 한 번 더 제거해 일반 텍스트로 반환
5. 링크는 모델이 쓰지 않고, 검색된 공고의 링크를 화면에서 따로 붙여 표시

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/postings` | 공고 목록 (삭제된 공고 제외, 최신순 최대 200건) |
| PATCH | `/api/postings/[id]` | 상태 변경. body `{ "status": "new \| interested \| hold \| rejected" }` |
| DELETE | `/api/postings/[id]` | 소프트 삭제 |
| POST | `/api/chat` | 챗봇. body `{ "message": "..." }` → `{ answer, sources }` |

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS · `pg`(node-postgres) · `@anthropic-ai/sdk` · Docker (멀티 스테이지, standalone)

## 실행

### Docker Compose로 실행 (권장)

이 프로젝트는 `job_email_agent`의 `docker-compose.yml`이 함께 빌드합니다. 두 폴더를 같은 부모 폴더에 나란히 두고 `job_email_agent`에서 실행하세요.

```bash
cd ../job_email_agent
docker compose up --build      # 대시보드: http://localhost:3000
```

DB 접속 정보와 API 키는 compose가 컨테이너에 주입합니다. 이미지에는 키가 들어가지 않습니다.

### 로컬 개발 (Docker 없이)

`job_email_agent`의 DB(스키마: `db/init/001_schema.sql`)가 떠 있어야 합니다.

```bash
npm install
```

`.env.local` 파일을 만들고 값을 채웁니다.

```
DB_HOST=localhost
DB_PORT=5433            # job_email_agent의 compose DB를 쓰는 경우 (호스트 포트 5433)
DB_NAME=job_agent
DB_USER=...
DB_PASSWORD=...
ANTHROPIC_API_KEY=...
VOYAGE_API_KEY=...
```

```bash
npm run dev                    # http://localhost:3000
```

`.env.local`은 저장소에 올리지 않습니다(`.gitignore`).

## Docker 이미지

`Dockerfile`은 3단계로 나눠 만듭니다.

1. **deps**: `npm ci`로 패키지 설치
2. **builder**: `next build` (`next.config.ts`의 `output: "standalone"`으로 실행에 필요한 파일만 추출)
3. **runner**: 추출된 결과만 담은 최종 이미지. 소스와 빌드 도구가 들어가지 않고, root가 아닌 일반 사용자로 실행

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                      # 목록·상태 버튼·삭제·챗봇 화면
│   └── api/
│       ├── postings/route.ts         # 목록 조회
│       ├── postings/[id]/route.ts    # 상태 변경(PATCH)·삭제(DELETE)
│       └── chat/route.ts             # RAG 챗봇
├── components/ChatBox.tsx            # 챗봇 UI
└── lib/db.ts                         # PostgreSQL 연결 풀
```

## 제약

- **인증이 없습니다.** 개인 PC에서 쓰는 용도이며, 인터넷에 공개 배포하려면 로그인과 접근 제어가 먼저 필요합니다.
- 챗봇은 전체 데이터가 아니라 **유사도 상위 5건**만 보고 답합니다. 지역·모집 여부 같은 조건은 임베딩 검색이 엄밀하게 반영하지 못해, 조건 필터를 SQL로 먼저 거는 하이브리드 검색은 향후 과제입니다.
- 목록은 최근 200건까지만 불러옵니다(페이지네이션 없음).
