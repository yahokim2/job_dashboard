import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

const ALLOWED_STATUSES = ["new", "interested", "hold", "rejected"];

// 상태 변경 (관심/보류/거절)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status?: string };

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "잘못된 상태값입니다." }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE job_postings
       SET status = $1, status_updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, status`,
      [status, id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "해당 공고를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }
}

// 삭제: 행을 지우지 않고 deleted_at만 기록(소프트 삭제).
// 이유: 행이 남아 있어야 같은 메일을 다시 처리해도 ingest.py의 중복 방지(ON CONFLICT)가
// 작동해서, 한번 삭제한 공고가 되살아나지 않는다.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await pool.query(
      `UPDATE job_postings
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "해당 공고를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "삭제에 실패했습니다." }, { status: 500 });
  }
}
