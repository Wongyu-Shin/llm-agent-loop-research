import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Bug,
  CheckCircle2,
  Code2,
  ExternalLink,
  Info,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { conceptNav } from "@/lib/navigation";

export type TocItem = {
  id: string;
  label: string;
};

export function ArticlePage({ children, toc }: { children: ReactNode; toc?: TocItem[] }) {
  return (
    <div className={toc?.length ? "article-grid" : "article-grid without-toc"}>
      <article className="doc-article">{children}</article>
      {toc?.length ? (
        <aside className="page-toc" aria-label="페이지 목차">
          <span>이 페이지</span>
          <ol>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </div>
  );
}

export function DocHero({
  index,
  acronym,
  title,
  lead,
  context,
}: {
  index: string;
  acronym: string;
  title: string;
  lead: string;
  context?: string;
}) {
  return (
    <header className="doc-hero">
      <div className="hero-kicker">
        <span>{index}</span>
        <span>{acronym}</span>
      </div>
      <h1>{title}</h1>
      <p>{lead}</p>
      {context ? <div className="hero-context">{context}</div> : null}
    </header>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="doc-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LeadStatement({ children }: { children: ReactNode }) {
  return <div className="lead-statement">{children}</div>;
}

export function Note({ label, children, tone = "neutral" }: { label: string; children: ReactNode; tone?: "neutral" | "warn" | "good" }) {
  const Icon = tone === "warn" ? TriangleAlert : tone === "good" ? CheckCircle2 : Info;

  return (
    <aside className={`doc-note note-${tone}`}>
      <div className="note-label">
        <Icon aria-hidden="true" size={17} />
        <strong>{label}</strong>
      </div>
      <div>{children}</div>
    </aside>
  );
}

export function ModelCheckpoint({
  label,
  question,
  known,
  unknown,
}: {
  label: string;
  question: string;
  known: string;
  unknown: string;
}) {
  return (
    <aside className="model-checkpoint" aria-label={`${label} 사례`}>
      <div className="checkpoint-kicker">
        <Bug aria-hidden="true" size={16} />
        <span>{label}</span>
      </div>
      <p className="checkpoint-question">{question}</p>
      <dl>
        <div>
          <dt>지금 아는 것</dt>
          <dd>{known}</dd>
        </div>
        <div>
          <dt>실행 전에는 모르는 것</dt>
          <dd>{unknown}</dd>
        </div>
      </dl>
    </aside>
  );
}

type TraceStatus = "goal" | "fail" | "evidence" | "pass";

const traceStatusLabel: Record<TraceStatus, string> = {
  goal: "목표",
  fail: "실패",
  evidence: "반례",
  pass: "통과",
};

export function RunningExampleTrace({
  items,
}: {
  items: Array<{
    iteration: string;
    action: string;
    observation: string;
    retained: string;
    status: TraceStatus;
  }>;
}) {
  return (
    <ol className="running-trace" aria-label="결제 API 수정 작업 기록">
      {items.map((item) => (
        <li key={item.iteration} className={`trace-${item.status}`}>
          <div className="trace-step">
            <span>{item.iteration}</span>
            <strong>{traceStatusLabel[item.status]}</strong>
          </div>
          <div>
            <span>Action</span>
            <p>{item.action}</p>
          </div>
          <div>
            <span>Observation</span>
            <p>{item.observation}</p>
          </div>
          <div>
            <span>Retained evidence</span>
            <p>{item.retained}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TermGrid({
  items,
}: {
  items: Array<{ symbol: string; term: string; description: string }>;
}) {
  return (
    <dl className="term-grid">
      {items.map((item) => (
        <div key={`${item.symbol}-${item.term}`}>
          <dt>
            <code>{item.symbol}</code>
            <span>{item.term}</span>
          </dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ComparisonTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="comparison-table-scroll">
      <table className="comparison-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="source-link" href={href} target="_blank" rel="noreferrer">
      <BookOpenText aria-hidden="true" size={16} />
      <span>{children}</span>
      <ExternalLink aria-hidden="true" size={14} />
    </a>
  );
}

export function PageNav({ previous, next }: { previous?: string; next?: string }) {
  const previousItem = conceptNav.find((item) => item.href === previous);
  const nextItem = conceptNav.find((item) => item.href === next);

  return (
    <nav className="page-nav" aria-label="이전 및 다음 개념">
      {previousItem ? (
        <Link href={previousItem.href} className="page-nav-link previous">
          <ArrowLeft aria-hidden="true" size={18} />
          <span>
            <small>이전</small>
            <strong>{previousItem.shortLabel}</strong>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {nextItem ? (
        <Link href={nextItem.href} className="page-nav-link next">
          <span>
            <small>다음</small>
            <strong>{nextItem.shortLabel}</strong>
          </span>
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      ) : null}
    </nav>
  );
}

function Track({
  title,
  question,
  description,
  track,
}: {
  title: string;
  question: string;
  description: string;
  track: "decision" | "synthesis";
}) {
  const Icon = track === "decision" ? Workflow : Code2;
  const items = conceptNav.filter((item) => item.track === track);

  return (
    <section className="model-track">
      <header>
        <Icon aria-hidden="true" size={19} />
        <div>
          <span>{title}</span>
          <strong>{question}</strong>
          <p>{description}</p>
        </div>
      </header>
      <div className="track-links">
        {items.map((item) => (
          <Link href={item.href} key={item.href}>
            <span>{item.shortLabel}</span>
            <strong>{item.label}</strong>
            <small>{item.description}</small>
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function TwoTrackMap() {
  return (
    <div className="two-track-map" aria-label="Agent loop를 설명하는 두 질문 축">
      <Track
        title="환경 의사결정"
        question="다음에는 무엇을 실행할까?"
        description="repository와 외부 시스템에서 어떤 행동을 고를지 설명합니다."
        track="decision"
      />
      <Track
        title="후보 개선"
        question="다음에는 어떤 patch를 만들까?"
        description="검증 결과가 가능한 수정안의 범위를 어떻게 줄이는지 설명합니다."
        track="synthesis"
      />
    </div>
  );
}
