import { Pool } from "pg";

// Next.js 개발 모드에서는 코드가 바뀔 때마다 모듈이 다시 로드되는데,
// 그때마다 새 Pool을 만들면 DB 커넥션이 계속 쌓인다.
// globalThis에 캐싱해서 하나만 재사용하도록 방지.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}
