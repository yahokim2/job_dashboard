# ============================================================
# 대시보드(Next.js) 이미지 — 멀티 스테이지 빌드
#   1) deps    : 패키지 설치
#   2) builder : 소스 빌드 (next build)
#   3) runner  : 실행에 필요한 최소 파일만 담은 최종 이미지
# 최종 이미지에는 소스·devDependencies·빌드 도구가 들어가지 않아 작고 안전하다.
# ============================================================

# ---- 1) 의존성 설치 ----
FROM node:24-slim AS deps
WORKDIR /app
# package*.json만 먼저 복사 → 소스만 바뀐 경우 이 단계는 캐시를 재사용 (빌드 속도)
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2) 빌드 ----
FROM node:24-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3) 실행 ----
FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 보안: root가 아닌 일반 사용자로 실행
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
