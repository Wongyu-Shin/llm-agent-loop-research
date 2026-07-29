"use client";

import { BookOpen, FileText, GitFork, Menu, RefreshCcw, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { conceptNav } from "@/lib/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.endsWith(`${href}/`);
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = [
    { id: "decision", label: "다음 행동" },
    { id: "synthesis", label: "다음 후보" },
  ] as const;

  return (
    <nav className="concept-nav" aria-label="개념 문서">
      <Link
        className={pathname === "/" ? "nav-overview is-active" : "nav-overview"}
        href="/"
        onClick={onNavigate}
      >
        <BookOpen size={17} aria-hidden="true" />
        <span>전체 지도</span>
      </Link>
      <Link
        className={matchesPath(pathname, "/self-correction-scaling") ? "nav-overview is-active" : "nav-overview"}
        href="/self-correction-scaling"
        onClick={onNavigate}
      >
        <FileText size={17} aria-hidden="true" />
        <span>자기수정 리포트</span>
      </Link>
      {groups.map((group) => (
        <div className="nav-group" key={group.id}>
          <span className="nav-group-label">{group.label}</span>
          <ol>
            {conceptNav.filter((item) => item.track === group.id).map((item) => {
              const active = matchesPath(pathname, item.href);
              const index = conceptNav.findIndex((candidate) => candidate.href === item.href);
              return (
                <li key={item.href}>
                  <Link
                    className={active ? "nav-item is-active" : "nav-item"}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <span className="nav-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="nav-copy">
                      <strong>{item.shortLabel}</strong>
                      <small>{item.description}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}

export function SiteChrome() {
  const pathname = usePathname();
  const [openAtPath, setOpenAtPath] = useState<string | null>(null);
  const open = openAtPath === pathname;
  const isResearchDeck = matchesPath(pathname, "/self-correction-scaling");

  useEffect(() => {
    document.body.dataset.navOpen = !isResearchDeck && open ? "true" : "false";
    return () => {
      delete document.body.dataset.navOpen;
    };
  }, [isResearchDeck, open]);

  if (isResearchDeck) {
    return null;
  }

  return (
    <>
      <header className="site-header">
        <Link className="site-brand" href="/" aria-label="Agent Loop Field Guide 홈">
          <span className="brand-mark" aria-hidden="true">
            <RefreshCcw size={17} />
          </span>
          <span>
            <strong>Agent Loop Field Guide</strong>
            <small>for web engineers</small>
          </span>
        </Link>

        <div className="header-actions">
          <a
            className="icon-button repository-link"
            href="https://github.com/Wongyu-Shin/llm-agent-loop-research"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 저장소 열기"
            title="GitHub 저장소"
          >
            <GitFork aria-hidden="true" size={18} />
          </a>
          <ThemeToggle />
          <button
            className="icon-button mobile-menu-button"
            type="button"
            onClick={() => setOpenAtPath(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
            title={open ? "메뉴 닫기" : "메뉴 열기"}
          >
            {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </header>

      <aside className="site-sidebar" aria-label="주 내비게이션">
        <NavItems />
        <p className="sidebar-note">결제 API 버그 하나로 네 모델의 역할을 구분합니다.</p>
      </aside>

      <div id="mobile-navigation" className={open ? "mobile-drawer is-open" : "mobile-drawer"}>
        <NavItems onNavigate={() => setOpenAtPath(null)} />
      </div>
      {open ? <button className="nav-scrim" type="button" onClick={() => setOpenAtPath(null)} aria-label="메뉴 닫기" /> : null}
    </>
  );
}
