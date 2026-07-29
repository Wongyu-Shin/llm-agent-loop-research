import type { Metadata } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import "./globals.css";
import { SiteChrome } from "@/components/site-nav";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wongyu-shin.github.io/llm-agent-loop-research";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Agent Loop Field Guide",
    template: "%s | Agent Loop Field Guide",
  },
  description: "웹앱 엔지니어를 위해 결제 API 버그 사례로 MDP, POMDP, OGIS, CEGIS와 agent loop의 작동 조건을 설명하는 인터랙티브 문서",
  openGraph: {
    title: "Agent Loop Field Guide",
    description: "실행 결과, 관찰, oracle, 반례로 이해하는 agent loop",
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
  },
};

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem('agent-loop-theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = stored || preferred;
  } catch (_) {
    document.documentElement.dataset.theme = 'light';
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 이동
        </a>
        <SiteChrome />
        <main id="main-content" className="site-main">
          {children}
        </main>
      </body>
    </html>
  );
}
