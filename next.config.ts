import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지를 작게 만들기 위한 설정:
  // 실행에 꼭 필요한 파일만 .next/standalone 폴더에 모아서 만들어 준다.
  output: "standalone",
};

export default nextConfig;
