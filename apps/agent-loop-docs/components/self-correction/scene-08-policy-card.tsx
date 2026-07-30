"use client";

import { useRef, useState } from "react";

import { LabShell, useSvgIdPrefix } from "@/components/visualizations/viz-shell";
import {
  BLANK_POLICY_YAML,
  FINAL_TAKEAWAYS,
  LOOP_CAUTIONS,
  LOOP_POLICY_SECTIONS,
  SYNTHETIC_POLICY_YAML,
} from "./loop-model";
import { ProvenanceBadge } from "./presentation-shell";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./loop-scenes.module.css";

/**
 * 와이어프레임 §4.2 — 여섯 주의. autoresearch의 돌파를 verifier 전제가
 * 무너지는 실무로 옮길 때의 경고를 서사 컬럼에 상시 노출한다. cohort·
 * snapshot 항목은 논문 정리 문서의 명시적 제한(critical-reading)이다.
 */
export function CautionBand() {
  return (
    <div className={styles.cautionBand} data-caution-band>
      <div className={styles.officialStripHeading}>
        <ProvenanceBadge kind="critical-reading" />
        <ProvenanceBadge kind="engineering-transfer" />
      </div>
      <ol>
        {LOOP_CAUTIONS.map((caution) => (
          <li key={caution.id} data-caution={caution.id}>
            <strong>{caution.title}</strong>
            <span>{caution.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SECTION_STEPS: PlaybackStep[] = LOOP_POLICY_SECTIONS.map((section) => ({
  id: `section-${section.id}`,
  durationMs: Math.round(16000 / LOOP_POLICY_SECTIONS.length),
  label: `${section.shortLabel} 구역`,
}));

const STEPS: PlaybackStep[] = [
  ...SECTION_STEPS,
  { id: "fill-example", durationMs: 10000, label: "synthetic example 채우기" },
  { id: "final-hold", durationMs: 4000, label: "최종 세 문장 고정" },
];

type PolicyTab = "blank" | "synthetic";

/**
 * Scene 8 visual (wireframe §10 + reports/scene7-8-autoresearch-wireframe.md
 * §4). The one-page loop policy card: eight zones highlighted top-to-bottom,
 * then the synthetic checkout example fills the same zones. YAML is
 * copyable; the values are synthetic, not operational numbers.
 */
export function LoopPolicyCard() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction, reachedStep } =
    useScenePlayback(STEPS, containerRef);
  const idPrefix = useSvgIdPrefix("policy-card");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [userTab, setUserTab] = useState<PolicyTab | null>(null);
  const [copied, setCopied] = useState(false);

  const autoTab: PolicyTab = reachedStep("fill-example") ? "synthetic" : "blank";
  const tab = userTab ?? autoTab;

  const stepId =
    state.status === "idle"
      ? SECTION_STEPS[0].id
      : STEPS[Math.min(state.step, STEPS.length - 1)].id;
  const highlightedSection = stepId.startsWith("section-")
    ? stepId.slice("section-".length)
    : null;

  const selectTab = (value: PolicyTab) => {
    markUserInteraction();
    setUserTab(value);
  };

  const yaml = tab === "blank" ? BLANK_POLICY_YAML : SYNTHETIC_POLICY_YAML;

  const copyYaml = async () => {
    markUserInteraction();
    try {
      await navigator.clipboard.writeText(yaml);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context);
      // the toast still confirms which YAML was requested.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div ref={containerRef} data-policy-card data-tab={tab} data-stage={stepId}>
      <LabShell
        title="Loop policy card"
        subtitle="목표·범위·예산·증거·채택·기억·중단·책임을 한 장에 명세한다"
        legend={[
          { label: "blank template", tone: "neutral" },
          { label: "synthetic example", tone: "attention" },
        ]}
        stageLabel={
          tab === "blank" ? "BLANK CONTRACT" : "SYNTHETIC CHECKOUT POLICY"
        }
        actions={
          <div role="tablist" aria-label="policy 보기" className={styles.modeTabs}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "blank"}
              onClick={() => selectTab("blank")}
            >
              blank
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "synthetic"}
              onClick={() => selectTab("synthetic")}
            >
              synthetic 예시
            </button>
          </div>
        }
        controls={
          <>
            <PlaybackBar
              state={state}
              controls={controls}
              stepCount={STEPS.length}
              stepLabel={STEPS[Math.min(state.step, STEPS.length - 1)].label}
              markUserInteraction={markUserInteraction}
            />
            <button
              type="button"
              className={styles.copyButton}
              onClick={copyYaml}
            >
              YAML 복사
            </button>
            {copied ? (
              <span className={styles.copyToast} data-copy-toast>
                {tab === "blank" ? "blank template" : "synthetic example"} YAML
                복사됨
              </span>
            ) : null}
          </>
        }
        status={[
          {
            label: "보기",
            value:
              tab === "blank"
                ? "blank template"
                : "synthetic example · 실제 운영 수치 아님",
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>여덟 구역의 정의와 synthetic 예시 값입니다.</p>
            <dl className={styles.policyList}>
              {LOOP_POLICY_SECTIONS.map((section) => (
                <div key={section.id} data-section={section.id}>
                  <dt>{section.title}</dt>
                  <dd>
                    {tab === "blank"
                      ? section.blankPrompt
                      : section.exampleValue.join(" · ")}
                  </dd>
                </div>
              ))}
            </dl>
            <pre className={styles.pseudocode} data-policy-yaml aria-label="loop policy YAML">
              {yaml}
            </pre>
            <p>
              synthetic 예시는 화면 구조를 보여 주기 위한 값이며 실제 운영
              수치가 아닙니다.
            </p>
            <ol data-final-takeaways>
              {FINAL_TAKEAWAYS.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ol>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="loop policy card 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg viz-compact"
            viewBox="0 0 680 480"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>여덟 구역의 loop policy 카드</title>
            <desc id={descId}>
              goal, scope, budget, evidence, transition, memory, stop, owners
              구역이 위에서 아래로 강조되고, synthetic checkout 예시가 각
              구역을 채우는 한 장짜리 계약 카드.
            </desc>

            <rect className={styles.policyFrame} x="32" y="24" width="616" height="432" rx="16" />
            <text className={styles.policyTitle} x="56" y="58">
              loop_policy {tab === "synthetic" ? "· synthetic checkout" : "· blank"}
            </text>

            {LOOP_POLICY_SECTIONS.map((section, index) => {
              // 여덟 구역이 y=446 footnote와 겹치지 않도록 45px 간격.
              const y = 74 + index * 45;
              const active =
                highlightedSection === section.id ||
                (highlightedSection === null && state.status !== "idle");
              return (
                <g
                  key={section.id}
                  className={styles.policyZone}
                  data-active={active ? "true" : "false"}
                  data-filled={tab === "synthetic" ? "true" : "false"}
                >
                  <rect x="52" y={y} width="576" height="40" rx="8" />
                  <text className={styles.policyZoneLabel} x="68" y={y + 26}>
                    {section.shortLabel}
                  </text>
                  <text className={styles.policyZoneValue} x="170" y={y + 26}>
                    {tab === "blank"
                      ? section.blankPrompt
                      : section.exampleValue[0]}
                  </text>
                </g>
              );
            })}

            <text
              className={styles.policyFootnote}
              x="56"
              y="446"
            >
              synthetic policy · 실제 운영 수치가 아님
            </text>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
