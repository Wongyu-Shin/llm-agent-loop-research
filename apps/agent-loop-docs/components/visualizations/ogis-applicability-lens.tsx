"use client";

import { useId, useState } from "react";
import { LabShell, ResetButton, SegmentedControl } from "@/components/visualizations/viz-shell";

type BinaryChoice = "yes" | "no";
type VerdictKind = "ogis" | "blackbox" | "defer";

type ConditionCardProps = {
  x: number;
  eyebrow: string;
  title: string;
  detail: string;
  enabled: boolean;
  onToggle: () => void;
};

const BINARY_OPTIONS: Array<{ value: BinaryChoice; label: string }> = [
  { value: "yes", label: "있음" },
  { value: "no", label: "없음" },
];

const VERDICT_CARDS: Array<{
  id: VerdictKind;
  x: number;
  title: string;
  detail: [string, string];
}> = [
  {
    id: "ogis",
    x: 38,
    title: "OGIS-like",
    detail: ["candidate + typed evidence", "다음 learner 호출을 제한"],
  },
  {
    id: "blackbox",
    x: 326,
    title: "Black-box / one-shot",
    detail: ["feedback은 있지만", "version-space protocol은 불명확"],
  },
  {
    id: "defer",
    x: 614,
    title: "분류 보류",
    detail: ["candidate를 먼저 식별", "질문 축을 다시 확인"],
  },
];

function ConditionCard({
  x,
  eyebrow,
  title,
  detail,
  enabled,
  onToggle,
}: ConditionCardProps) {
  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  }

  return (
    <g
      className="viz-interactive"
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${enabled ? "있음" : "없음"}. 상태 전환`}
      aria-pressed={enabled}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <rect
        className={`viz-node ${enabled ? "viz-node-success" : "viz-node-attention"}`}
        x={x}
        y="70"
        width="190"
        height="126"
        rx="8"
      />
      <text className="viz-eyebrow" x={x + 18} y="98">{eyebrow}</text>
      <text className="viz-title" x={x + 18} y="128">{title}</text>
      <text className="viz-body" x={x + 18} y="154">{detail}</text>
      <text
        className="viz-value"
        x={x + 172}
        y="100"
        textAnchor="end"
        fill={enabled ? "var(--fg-success)" : "var(--fg-attention)"}
      >
        {enabled ? "YES" : "NO"}
      </text>
      <text className="viz-body" x={x + 18} y="180">
        클릭 · Enter · Space로 전환
      </text>
    </g>
  );
}

export function OgisApplicabilityLens() {
  const instanceId = useId().replace(/:/g, "");
  const titleId = `${instanceId}-ogis-applicability-title`;
  const descId = `${instanceId}-ogis-applicability-desc`;
  const arrowId = `${instanceId}-ogis-applicability-arrow`;

  const [candidateIdentified, setCandidateIdentified] = useState<BinaryChoice>("yes");
  const [typedProtocol, setTypedProtocol] = useState<BinaryChoice>("yes");
  const [responseRetained, setResponseRetained] = useState<BinaryChoice>("yes");

  const hasCandidate = candidateIdentified === "yes";
  const hasTypedProtocol = typedProtocol === "yes";
  const retainsResponse = responseRetained === "yes";
  const metConditions = [hasCandidate, hasTypedProtocol, retainsResponse].filter(Boolean).length;

  let verdict: {
    kind: VerdictKind;
    label: string;
    reason: string;
    nextCheck: string;
  };

  if (!hasCandidate) {
    verdict = {
      kind: "defer",
      label: "OGIS 조건 미충족 · 분류 보류",
      reason: "Candidate가 식별되지 않아 합성 framework를 적용할 근거가 부족합니다. POMDP는 hidden state와 action-dependent observation이라는 별도 신호가 있을 때만 검토합니다.",
      nextCheck: "candidate와 의사결정 질문 재구분",
    };
  } else if (!hasTypedProtocol) {
    verdict = {
      kind: "blackbox",
      label: "Black-box refinement",
      reason: "candidate는 있지만 query와 response의 정보 경계가 정해져 있지 않습니다.",
      nextCheck: "response schema와 제거 후보",
    };
  } else if (!retainsResponse) {
    verdict = {
      kind: "blackbox",
      label: "One-shot verification",
      reason: "typed response가 다음 learner 입력의 evidence로 보존되지 않습니다.",
      nextCheck: "response의 다음 iteration 유입",
    };
  } else {
    verdict = {
      kind: "ogis",
      label: "OGIS-like 구조",
      reason: "typed oracle response가 evidence가 되어 다음 candidate 범위를 줄입니다.",
      nextCheck: "oracle soundness와 version-space 갱신",
    };
  }

  const branchCenter =
    VERDICT_CARDS.find((item) => item.id === verdict.kind)?.x ?? VERDICT_CARDS[0].x;
  const branchTargetX = branchCenter + 124;

  function reset() {
    setCandidateIdentified("yes");
    setTypedProtocol("yes");
    setResponseRetained("yes");
  }

  return (
    <LabShell
      title="OGIS 적용 여부를 가르는 세 가지 interface 조건"
      subtitle="반복 횟수가 아니라 candidate, typed query-response, response retention이 실제 구현에 있는지 분류합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <>
          <SegmentedControl<BinaryChoice>
            label="Candidate 식별"
            value={candidateIdentified}
            options={BINARY_OPTIONS}
            onChange={setCandidateIdentified}
          />
          <SegmentedControl<BinaryChoice>
            label="Typed query-response"
            value={typedProtocol}
            options={BINARY_OPTIONS}
            onChange={setTypedProtocol}
          />
          <SegmentedControl<BinaryChoice>
            label="Response 보존"
            value={responseRetained}
            options={BINARY_OPTIONS}
            onChange={setResponseRetained}
          />
        </>
      }
      stageLabel="Applicability decision lens"
      legend={[
        { label: "조건 충족", tone: "success" },
        { label: "조건 누락", tone: "attention" },
        { label: "현재 분류", tone: "accent" },
      ]}
      status={[
        { label: "현재 판정", value: verdict.label },
        { label: "OGIS 조건", value: `${metConditions} / 3 충족` },
        { label: "다음 점검", value: verdict.nextCheck },
      ]}
      explanation={
        <>
          <strong>{verdict.label}</strong> · {verdict.reason}
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="OGIS 적용 조건과 인접한 문제 분류를 보여주는 도식, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className="viz-svg viz-wide ogis-applicability-svg"
          viewBox="0 0 900 430"
          role="group"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>OGIS 적용 조건 분류 렌즈</title>
          <desc id={descId}>
            Candidate 식별, typed query-response, response 보존의 세 조건을 바꾸면 현재 구현을 OGIS-like,
            black-box refinement, 또는 분류 보류로 판정합니다. POMDP는 별도의 부분 관측 신호가 필요합니다. 현재 판정은 {verdict.label}입니다.
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
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-accent)" />
            </marker>
          </defs>

          <text className="viz-eyebrow" x="38" y="42">THREE APPLICABILITY GATES · NOT A MATURITY LADDER</text>

          <ConditionCard
            x={38}
            eyebrow="GATE 01 · LEARNER"
            title="Candidate 식별 가능?"
            detail="patch · program · plan"
            enabled={hasCandidate}
            onToggle={() => setCandidateIdentified(hasCandidate ? "no" : "yes")}
          />
          <ConditionCard
            x={252}
            eyebrow="GATE 02 · ORACLE"
            title="Q/R type이 있는가?"
            detail="request · response schema"
            enabled={hasTypedProtocol}
            onToggle={() => setTypedProtocol(hasTypedProtocol ? "no" : "yes")}
          />
          <ConditionCard
            x={466}
            eyebrow="GATE 03 · MEMORY"
            title="응답을 보존하는가?"
            detail="Eₜ → next learner input"
            enabled={retainsResponse}
            onToggle={() => setResponseRetained(retainsResponse ? "no" : "yes")}
          />

          <path className="viz-flow" d="M228 133 H244" />
          <path className="viz-flow" d="M442 133 H458" />

          <rect
            className={`viz-node ${
              verdict.kind === "ogis"
                ? "viz-node-success"
                : verdict.kind === "defer"
                  ? "viz-node-accent"
                  : "viz-node-attention"
            }`}
            x="680"
            y="58"
            width="182"
            height="150"
            rx="10"
          />
          <text className="viz-eyebrow" x="700" y="88">CURRENT VERDICT</text>
          <text className="viz-title" x="700" y="119">{verdict.label}</text>
          <line className="viz-divider" x1="700" y1="137" x2="842" y2="137" />
          <text className="viz-body" x="700" y="160">{metConditions} / 3 conditions</text>
          <text className="viz-body" x="700" y="184">모형의 경계를 먼저 확인</text>

          <path
            className="viz-flow viz-flow-accent"
            d={`M771 208 V244 H${branchTargetX} V270`}
            markerEnd={`url(#${arrowId})`}
          />

          <text className="viz-eyebrow" x="38" y="264">CLASSIFICATION · ASK WHAT THE LOOP RETAINS</text>
          {VERDICT_CARDS.map((item) => {
            const active = item.id === verdict.kind;
            const toneClass = active
              ? item.id === "ogis"
                ? "viz-node-success"
                : item.id === "defer"
                  ? "viz-node-accent"
                  : "viz-node-attention"
              : "";

            return (
              <g key={item.id} opacity={active ? 1 : 0.54}>
                {active ? (
                  <rect
                    className="viz-selection-halo"
                    x={item.x - 4}
                    y="278"
                    width="256"
                    height="106"
                    rx="11"
                    fill="none"
                    stroke="var(--fg-accent)"
                    strokeWidth="2"
                  />
                ) : null}
                <rect
                  className={`viz-node ${toneClass}`}
                  x={item.x}
                  y="282"
                  width="248"
                  height="98"
                  rx="8"
                />
                <text className="viz-title" x={item.x + 18} y="314">{item.title}</text>
                <text className="viz-body" x={item.x + 18} y="340">
                  {item.detail[0]}
                </text>
                <text className="viz-body" x={item.x + 18} y="358">
                  {item.detail[1]}
                </text>
                <text className="viz-value" x={item.x + 18} y="374">
                  {active ? "CURRENT" : "ALTERNATIVE"}
                </text>
              </g>
            );
          })}

          <text className="viz-body" x="450" y="414" textAnchor="middle">
            OGIS-like 판정은 세 조건의 존재를 말하며, oracle의 정확성이나 수렴 보장까지 자동으로 뜻하지 않습니다.
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
