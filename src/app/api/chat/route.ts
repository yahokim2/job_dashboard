import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "@/lib/db";

const EMBEDDING_DIM = 512; // ingest.py, migration_003_pgvector.sql과 반드시 일치해야 함

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

type PostingRow = {
  id: number;
  title: string | null;
  company: string | null;
  source: string;
  required_skills: string[] | null;
  expected_pay: string | null;
  start_date: string | null;
  expected_duration: string | null;
  location: string | null;
  is_closed: boolean | null;
  detail_url: string | null;
};

// Voyage는 공식 Node.js SDK가 없어서 REST API를 직접 호출 (Python의 voyageai.Client와 동일한 역할)
async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: "voyage-4-lite",
      input_type: "query",
      output_dimension: EMBEDDING_DIM,
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage 임베딩 요청 실패: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function searchPostings(queryVector: number[], topK = 5): Promise<PostingRow[]> {
  // pg(node-postgres)엔 pgvector 전용 타입 변환기가 없어서, 벡터를 '[0.1,0.2,...]' 문자열로
  // 만들어 넘기고 SQL에서 ::vector로 캐스팅 (Python의 register_vector와 다른 점)
  const vectorLiteral = `[${queryVector.join(",")}]`;
  const result = await pool.query(
    `SELECT id, title, company, source, required_skills, expected_pay,
            start_date, expected_duration, location, is_closed, detail_url
     FROM job_postings
     WHERE embedding IS NOT NULL AND deleted_at IS NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorLiteral, topK]
  );
  return result.rows;
}

function formatPostingsForPrompt(rows: PostingRow[]): string {
  return rows
    .map((r, i) => {
      const status = r.is_closed ? "모집종료" : "모집중";
      return (
        `${i + 1}. [${status}] [${r.source}] ${r.title}\n` +
        `   회사: ${r.company ?? "비공개"} / 스킬: ${(r.required_skills ?? []).join(", ")}\n` +
        `   예상금액: ${r.expected_pay ?? "정보없음"} / 근무위치: ${r.location ?? "정보없음"}\n` +
        `   시작일: ${r.start_date ?? "정보없음"} / 기간: ${r.expected_duration ?? "정보없음"}`
      );
    })
    .join("\n\n");
}

// 프롬프트로 요청해도 마크다운·이모지가 섞여 나올 수 있어서, 화면에 보내기 전에 한 번 더 제거
function toPlainText(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // 이모지 등 BMP 밖 문자
    .replace(/[\u2600-\u27BF\uFE0F]/g, "") // 체크·경고 기호 등
    .replace(/^#{1,6}\s*/gm, "") // 제목 기호
    .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, "") // 구분선
    .replace(/\*\*/g, "") // 굵게
    .replace(/`/g, "") // 백틱
    .replace(/^>\s?/gm, "") // 인용
    .replace(/[ \t]+$/gm, "") // 줄 끝 공백 (이모지 제거 후 남는 것)
    .replace(/^ (?=\S)/gm, "") // 줄 앞 공백 1칸 (이모지 제거 후 남는 것)
    .replace(/\n{3,}/g, "\n\n") // 빈 줄 과다 정리
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const { message } = (await request.json()) as { message?: string };
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "질문이 비어있습니다." }, { status: 400 });
    }

    const queryVector = await embedQuery(message);
    const rows = await searchPostings(queryVector, 5);

    if (rows.length === 0) {
      return NextResponse.json({
        answer: "저장된 공고가 없거나 관련된 공고를 찾지 못했습니다.",
        sources: [],
      });
    }

    const postingsText = formatPostingsForPrompt(rows);
    // 링크는 모델이 직접 베끼지 않게 하고, sources로 따로 내려서 프론트에서 붙임 (토큰 낭비·오타 방지)
    const prompt =
      `다음은 사용자의 질문과 관련해 검색된 구인 프로젝트 목록입니다. 검색 결과는 최대 5건이며, ` +
      `전체 데이터가 아니라 질문과 가장 유사한 일부입니다.\n\n` +
      `답변 규칙:\n` +
      `1. 한국어 일반 텍스트로만 답하세요. 마크다운 기호(#, *, 표, 구분선, 백틱)와 이모지는 쓰지 마세요. ` +
      `여러 항목은 줄바꿈과 "1." 같은 번호로 구분하세요.\n` +
      `2. 질문 조건에 맞는 공고가 목록에 없으면 "검색된 공고(최대 5건) 중에는 없습니다"라고 말하세요. ` +
      `전체 데이터에 없다고 단정하지 마세요.\n` +
      `3. 목록에 없는 내용은 지어내지 말고, 모르면 모른다고 하세요.\n` +
      `4. 링크는 출력하지 마세요 (별도로 화면에 표시됩니다).\n\n` +
      `질문: ${message}\n\n` +
      `검색된 공고 목록:\n${postingsText}`;

    const response = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    const answer = toPlainText(
      block.type === "text" ? block.text : "답변을 생성하지 못했습니다."
    );

    const sources = rows.map((r) => ({
      id: r.id,
      title: r.title,
      detail_url: r.detail_url,
    }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "챗봇 응답 생성에 실패했습니다." }, { status: 500 });
  }
}
