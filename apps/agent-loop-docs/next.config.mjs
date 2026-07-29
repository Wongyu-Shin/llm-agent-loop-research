import createMDX from "@next/mdx";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ["remark-math"],
    rehypePlugins: [
      "rehype-katex",
      [
        "@shikijs/rehype",
        {
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
          addLanguageClass: true,
          defaultColor: false,
        },
      ],
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  output: "export",
  // dev 전용: localhost와 127.0.0.1 어느 쪽으로 접속해도 Next 16이
  // /_next/* dev 리소스를 cross-origin으로 차단하지 않게 한다.
  // 차단되면 hydration이 안 돼 애니메이션·모드 토글이 모두 죽는다.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  turbopack: {
    root: process.cwd(),
  },
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default withMDX(nextConfig);
