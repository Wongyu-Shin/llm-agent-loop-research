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
