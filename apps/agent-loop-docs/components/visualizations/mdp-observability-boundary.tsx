"use client";

import { useId, useState } from "react";
import { LabShell, ResetButton, SegmentedControl } from "@/components/visualizations/viz-shell";

type FactorId = "repository" | "intent" | "hidden-tests" | "external-api";
type ApertureId = "prompt" | "workspace" | "tools" | "omniscient";
type Access = "direct" | "observation" | "hidden";

type Factor = {
  id: FactorId;
  eyebrow: string;
  title: string;
  short: string;
  description: string;
};

const FACTORS: Factor[] = [
  {
    id: "repository",
    eyebrow: "ACTUAL REPOSITORY",
    title: "코드와 runtime state",
    short: "Repository",
    description: "파일 · diff · dependency",
  },
  {
    id: "intent",
    eyebrow: "USER INTENT",
    title: "요구와 우선순위",
    short: "Intent",
    description: "명세 · 제약 · trade-off",
  },
  {
    id: "hidden-tests",
    eyebrow: "HIDDEN TESTS",
    title: "비공개 판정 조건",
    short: "Hidden test",
    description: "assertion · edge case",
  },
  {
    id: "external-api",
    eyebrow: "EXTERNAL API",
    title: "외부 시스템 state",
    short: "External API",
    description: "응답 · side effect",
  },
];

const INITIAL_RELEVANCE: Record<FactorId, boolean> = {
  repository: true,
  intent: true,
  "hidden-tests": true,
  "external-api": true,
};

const APERTURES: Record<
  ApertureId,
  {
    label: string;
    description: string;
    access: Record<FactorId, Access>;
  }
> = {
  prompt: {
    label: "Prompt만",
    description: "사용자 요청과 일부 snapshot만 context에 있습니다.",
    access: {
      repository: "observation",
      intent: "direct",
      "hidden-tests": "hidden",
      "external-api": "hidden",
    },
  },
  workspace: {
    label: "Workspace",
    description: "Repository와 명세는 읽지만 외부 판정 state는 보이지 않습니다.",
    access: {
      repository: "direct",
      intent: "direct",
      "hidden-tests": "hidden",
      "external-api": "hidden",
    },
  },
  tools: {
    label: "도구 관찰",
    description: "Test와 API를 실행해 observation을 받지만 내부 state 자체를 읽지는 못합니다.",
    access: {
      repository: "direct",
      intent: "direct",
      "hidden-tests": "observation",
      "external-api": "observation",
    },
  },
  omniscient: {
    label: "전체 state · 가정",
    description: "의사결정에 필요한 실제 state를 모두 직접 안다는 이론적 기준선입니다.",
    access: {
      repository: "direct",
      intent: "direct",
      "hidden-tests": "direct",
      "external-api": "direct",
    },
  },
};

const ACCESS_COPY: Record<Access, { short: string; detail: string; tone: string }> = {
  direct: {
    short: "DIRECT",
    detail: "state를 직접 읽음",
    tone: "success",
  },
  observation: {
    short: "oₜ ONLY",
    detail: "state에서 나온 관찰만 받음",
    tone: "attention",
  },
  hidden: {
    short: "HIDDEN",
    detail: "현재 context에 신호가 없음",
    tone: "danger",
  },
};

function accessStroke(access: Access) {
  if (access === "direct") return "var(--fg-success)";
  if (access === "observation") return "var(--fg-attention)";
  return "var(--fg-danger)";
}

function accessFill(access: Access) {
  if (access === "direct") return "var(--bg-success-muted)";
  if (access === "observation") return "var(--bg-attention-muted)";
  return "var(--bg-danger-muted)";
}

function handleKeyboardSelection(event: React.KeyboardEvent<SVGGElement>, select: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}

export function MdpObservabilityBoundary() {
  const uid = useId().replace(/:/g, "");
  const titleId = `mdp-observability-title-${uid}`;
  const descId = `mdp-observability-desc-${uid}`;
  const arrowId = `mdp-observability-arrow-${uid}`;

  const [aperture, setAperture] = useState<ApertureId>("tools");
  const [selectedFactor, setSelectedFactor] = useState<FactorId>("hidden-tests");
  const [relevance, setRelevance] =
    useState<Record<FactorId, boolean>>(INITIAL_RELEVANCE);

  const current = APERTURES[aperture];
  const selected = FACTORS.find((factor) => factor.id === selectedFactor) ?? FACTORS[0];
  const selectedAccess = current.access[selected.id];
  const relevantFactors = FACTORS.filter((factor) => relevance[factor.id]);
  const directCount = relevantFactors.filter(
    (factor) => current.access[factor.id] === "direct",
  ).length;
  const hiddenFactors = relevantFactors.filter(
    (factor) => current.access[factor.id] !== "direct",
  );
  const fullyObservable = relevantFactors.length > 0 && hiddenFactors.length === 0;

  function toggleFactor(factorId: FactorId) {
    setSelectedFactor(factorId);
    setRelevance((currentRelevance) => {
      const activeCount = FACTORS.filter((factor) => currentRelevance[factor.id]).length;
      if (currentRelevance[factorId] && activeCount === 1) return currentRelevance;
      return {
        ...currentRelevance,
        [factorId]: !currentRelevance[factorId],
      };
    });
  }

  function reset() {
    setAperture("tools");
    setSelectedFactor("hidden-tests");
    setRelevance(INITIAL_RELEVANCE);
  }

  return (
    <LabShell
      title="Code agent의 MDP 관측 가능성 경계"
      subtitle="실제 작업 state와 context aperture를 분리해 fully observable MDP와 hidden-state 모형의 경계를 확인합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <div className="mobile-two-row-segments">
          <SegmentedControl<ApertureId>
            label="Context aperture"
            value={aperture}
            options={[
              { value: "prompt", label: "Prompt만" },
              { value: "workspace", label: "Workspace" },
              { value: "tools", label: "도구 관찰" },
              { value: "omniscient", label: "전체 state · 가정" },
            ]}
            onChange={setAperture}
          />
        </div>
      }
      stageLabel="Actual state → context aperture → agent model"
      legend={[
        { label: "직접 관측", tone: "success" },
        { label: "observation만", tone: "attention" },
        { label: "hidden state", tone: "danger" },
        { label: "decision scope 제외", tone: "neutral" },
        { label: "마지막 조작 factor", tone: "accent" },
      ]}
      status={[
        { label: "직접 관측", value: `${directCount} / ${relevantFactors.length} relevant factors` },
        {
          label: "선택 factor",
          value: relevance[selected.id]
            ? `${selected.title} · ${ACCESS_COPY[selectedAccess].short}`
            : `${selected.title} · OUT OF SCOPE`,
        },
        {
          label: "적합한 표현",
          value: fullyObservable ? "Fully observable MDP" : "POMDP · belief over hidden state",
        },
      ]}
      explanation={
        <>
          <strong>{selected.title}</strong>은{" "}
          {relevance[selected.id]
            ? `현재 decision scope에 포함되며 ${ACCESS_COPY[selectedAccess].detail}.`
            : "현재 decision scope에서 제외되어 model state의 일부로 세지 않습니다."}{" "}
          {fullyObservable
            ? "모든 decision-relevant state를 직접 읽으므로 현재 state s로 다음 행동을 고르는 fully observable MDP 표현이 성립합니다."
            : `${hiddenFactors.map((factor) => factor.title).join(", ")}이 decision-relevant하지만 직접 보이지 않으므로 실제 state와 observation을 분리해야 합니다.`}{" "}
          이 경계는 과거 history의 요약 충분성이 아니라 <strong>현재 실제 state에 대한 접근 가능성</strong>을 묻습니다.
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="실제 작업 state와 context aperture의 관측 가능성 도식, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className="viz-svg viz-wide mdp-observability-svg"
          viewBox="0 0 900 430"
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <title id={titleId}>Code agent가 실제 작업 state를 직접 관측하는 범위</title>
          <desc id={descId}>
            Repository, 사용자 의도, hidden test, 외부 API의 실제 state가 선택한 context aperture를 통해 직접 state,
            observation, hidden state 중 무엇으로 agent에 전달되는지 보여줍니다.
          </desc>
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
            </marker>
          </defs>

          <text className="viz-eyebrow" x="42" y="32">
            ENVIRONMENT · ACTUAL DECISION-RELEVANT STATE
          </text>
          <rect className="viz-lane" x="42" y="48" width="816" height="142" rx="8" />

          {FACTORS.map((factor, index) => {
            const x = 58 + index * 200;
            const access = current.access[factor.id];
            const isRelevant = relevance[factor.id];
            const isSelected = selectedFactor === factor.id;

            return (
              <g
                key={factor.id}
                className="viz-interactive"
                role="button"
                tabIndex={0}
                aria-label={`${factor.title}, ${isRelevant ? "decision scope에 포함" : "decision scope에서 제외"}, ${ACCESS_COPY[access].detail}. 눌러서 scope를 전환`}
                aria-pressed={isRelevant}
                onClick={() => toggleFactor(factor.id)}
                onKeyDown={(event) =>
                  handleKeyboardSelection(event, () => toggleFactor(factor.id))
                }
              >
                {isSelected ? (
                  <rect
                    className="viz-selection-halo"
                    x={x - 4}
                    y="67"
                    width="188"
                    height="108"
                    rx="9"
                    fill="none"
                    stroke="var(--fg-accent)"
                    strokeWidth="2"
                  />
                ) : null}
                <rect
                  className="viz-node"
                  x={x}
                  y="71"
                  width="180"
                  height="100"
                  rx="6"
                  opacity={isRelevant ? 1 : 0.5}
                />
                <text className="viz-eyebrow" x={x + 14} y="94">
                  {factor.eyebrow}
                </text>
                <text className="viz-title" x={x + 14} y="120">
                  {factor.title}
                </text>
                <text className="viz-body" x={x + 14} y="142">
                  {factor.description}
                </text>
                <rect
                  x={x + 14}
                  y="151"
                  width="78"
                  height="15"
                  rx="3"
                  fill={isRelevant ? accessFill(access) : "var(--bg-subtle)"}
                  stroke={isRelevant ? accessStroke(access) : "var(--border-emphasis)"}
                />
                <text
                  x={x + 53}
                  y="162"
                  textAnchor="middle"
                  className="mono"
                  fontSize="9"
                  fill={isRelevant ? accessStroke(access) : "var(--fg-muted)"}
                >
                  {isRelevant ? ACCESS_COPY[access].short : "OUT OF SCOPE"}
                </text>
              </g>
            );
          })}

          <text className="viz-eyebrow" x="42" y="214">
            CONTEXT APERTURE · {current.label.toUpperCase()}
          </text>
          {FACTORS.map((factor, index) => {
            const x = 58 + index * 200;
            const access = current.access[factor.id];
            const isRelevant = relevance[factor.id];
            return (
              <g key={`aperture-${factor.id}`}>
                <path
                  className="viz-edge"
                  d={`M${x + 90} 171 V226`}
                  fill="none"
                  stroke={isRelevant ? accessStroke(access) : "var(--border-muted)"}
                  strokeWidth={isRelevant && access === "direct" ? 2 : 1.5}
                  strokeDasharray={isRelevant && access === "direct" ? undefined : "5 4"}
                  opacity={isRelevant ? 1 : 0.42}
                />
                <rect
                  x={x}
                  y="226"
                  width="180"
                  height="34"
                  rx="5"
                  fill={isRelevant ? accessFill(access) : "var(--bg-subtle)"}
                  stroke={isRelevant ? accessStroke(access) : "var(--border-muted)"}
                  opacity={isRelevant ? 1 : 0.58}
                />
                <text
                  className="mono"
                  x={x + 90}
                  y="248"
                  textAnchor="middle"
                  fontSize="10"
                  fill={isRelevant ? accessStroke(access) : "var(--fg-muted)"}
                >
                  {isRelevant ? ACCESS_COPY[access].short : "OUT OF SCOPE"}
                </text>
              </g>
            );
          })}

          <rect className="viz-lane" x="42" y="292" width="816" height="112" rx="8" />
          <text className="viz-eyebrow" x="62" y="316">
            AGENT INPUT
          </text>
          <rect className="viz-node" x="62" y="328" width="500" height="58" rx="6" />

          {FACTORS.map((factor, index) => {
            const access = current.access[factor.id];
            const isRelevant = relevance[factor.id];
            const chipX = 76 + index * 119;
            const label =
              !isRelevant
                ? `${factor.short} · —`
                : access === "direct"
                  ? factor.short
                : access === "observation"
                    ? `${factor.short} · oₜ`
                    : `${factor.short} · ?`;
            return (
              <g key={`agent-${factor.id}`}>
                <path
                  className="viz-edge"
                  d={`M${148 + index * 200} 260 C${148 + index * 200} 282 ${chipX + 52} 286 ${chipX + 52} 328`}
                  fill="none"
                  stroke={isRelevant ? accessStroke(access) : "var(--border-muted)"}
                  strokeWidth={isRelevant && access === "direct" ? 2 : 1.5}
                  strokeDasharray={isRelevant && access === "direct" ? undefined : "5 4"}
                  markerEnd={`url(#${arrowId})`}
                  opacity={isRelevant ? 1 : 0.35}
                />
                <rect
                  x={chipX}
                  y="344"
                  width="105"
                  height="25"
                  rx="4"
                  fill={isRelevant ? accessFill(access) : "var(--bg-subtle)"}
                  stroke={isRelevant ? accessStroke(access) : "var(--border-muted)"}
                />
                <text
                  x={chipX + 52.5}
                  y="360"
                  textAnchor="middle"
                  fontSize="9"
                  fill={isRelevant ? accessStroke(access) : "var(--fg-muted)"}
                >
                  {label}
                </text>
              </g>
            );
          })}

          <path
            className={fullyObservable ? "viz-flow viz-flow-success" : "viz-flow viz-flow-attention"}
            d="M562 357 H602"
            markerEnd={`url(#${arrowId})`}
          />
          <rect
            className={`viz-node ${fullyObservable ? "viz-node-success" : "viz-node-attention"}`}
            x="618"
            y="321"
            width="220"
            height="72"
            rx="6"
          />
          <text className="viz-eyebrow" x="638" y="346">
            MODEL FRAME
          </text>
          <text className="viz-title" x="638" y="371">
            {fullyObservable ? "sₜ로 행동 선택 · MDP" : "bₜ(s)로 행동 선택 · POMDP"}
          </text>
          <text className="viz-body" x="450" y="423" textAnchor="middle">
            {current.description}
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
