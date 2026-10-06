import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// 빌드 시점에 DB를 조회하려 하지 않도록, 항상 요청이 들어온 시점에 실행
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, title, company, source, required_skills, expected_pay,
              start_date, expected_duration, location, is_closed,
              detail_url, status, received_at
       FROM job_postings
       WHERE deleted_at IS NULL
       ORDER BY received_at DESC
       LIMIT 200`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "공고 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
