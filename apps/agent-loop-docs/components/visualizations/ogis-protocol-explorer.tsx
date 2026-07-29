"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { LabShell, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type QueryType = "membership" | "example" | "equivalence" | "correctness";
type ProtocolStep = "candidate" | "query" | "response" | "update";

const QUERY_DATA: Record<
  QueryType,
  {
    label: string;
    request: string;
    response: string;
    evidence: string;
    removed: string;
    information: string;
  }
> = {
  membership: {
    label: "Membership",
    request: "membership({ discount: 4 })",
    response: "{ label: reject }",
    evidence: "(4, reject)",
    removed: "4를 허용하는 후보",
    information: "선택한 입력 하나의 label",
  },
  example: {
    label: "Example",
    request: "example()",
    response: "{ discount: -1, label: reject }",
    evidence: "(-1, reject)",
    removed: "-1을 허용하는 후보",
    information: "oracle이 고른 labeled input",
  },
  equivalence: {
    label: "Equivalence",
    request: "equivalence(h₁: d ≥ 0)",
    response: "{ counterexample: d=4, label: reject }",
    evidence: "(4, reject)",
    removed: "현재 h₁과 같은 오류를 내는 후보",
    information: "현재 후보를 깨는 반례 또는 accept",
  },
  correctness: {
    label: "Correctness",
    request: "correctness(h₁: d ≥ 0)",
    response: "{ correct: false }",
    evidence: "false",
    removed: "현재 후보 h₁",
    information: "판정만 제공, 수정 방향은 적음",
  },
};

const STEPS: Array<{ id: ProtocolStep; label: string; actor: string }> = [
  { id: "candidate", label: "후보 선택", actor: "Learner" },
  { id: "query", label: "질의 구성", actor: "Harness" },
  { id: "response", label: "응답 생성", actor: "Oracle" },
  { id: "update", label: "Evidence 갱신", actor: "Memory" },
];

function stepIndex(step: ProtocolStep) {
  return STEPS.findIndex((item) => item.id === step);
}

export function OgisProtocolExplorer() {
  const [queryType, setQueryType] = useState<QueryType>("equivalence");
  const [step, setStep] = useState<ProtocolStep>("candidate");
  const index = stepIndex(step);
  const data = QUERY_DATA[queryType];
  const active = STEPS[index];
  const svgPrefix = useSvgIdPrefix("ogis-protocol");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;
  const accentArrowId = `${svgPrefix}-arrow-accent`;

  function move(delta: number) {
    const next = Math.max(0, Math.min(STEPS.length - 1, index + delta));
    setStep(STEPS[next].id);
  }

  function reset() {
    setQueryType("equivalence");
    setStep("candidate");
  }

  return (
    <LabShell
      title="Query와 response type으로 구성한 OGIS protocol"
      subtitle="Membership, example, equivalence, correctness 질의가 각각 어떤 evidence를 남기는지 확인합니다."
      actions={
        <>
          <button className="lab-icon-button" type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="이전 protocol 단계" title="이전 protocol 단계">
            <ChevronLeft aria-hidden="true" size={17} />
          </button>
          <button className="lab-icon-button" type="button" onClick={() => move(1)} disabled={index === STEPS.length - 1} aria-label="다음 protocol 단계" title="다음 protocol 단계">
            <ChevronRight aria-hidden="true" size={17} />
          </button>
          <ResetButton onClick={reset} />
        </>
      }
      controls={
        <>
          <div className="mobile-two-row-segments">
            <SegmentedControl<QueryType>
              label="Query type"
              value={queryType}
              options={[
                { value: "membership", label: "Membership" },
                { value: "example", label: "Example" },
                { value: "equivalence", label: "Equivalence" },
                { value: "correctness", label: "Correctness" },
              ]}
              onChange={(value) => {
                setQueryType(value);
                setStep("candidate");
              }}
            />
          </div>
          <SegmentedControl<ProtocolStep>
            label="Protocol 단계"
            value={step}
            options={STEPS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={setStep}
          />
        </>
      }
      stageLabel={`${data.label} query · step ${index + 1}`}
      legend={[
        { label: "현재 actor", tone: "accent" },
        { label: "oracle boundary", tone: "attention" },
        { label: "누적 evidence", tone: "success" },
      ]}
      status={[
        { label: "현재 actor", value: active.actor },
        { label: "Response가 주는 정보", value: data.information },
        { label: "제거 가능한 후보", value: index >= 3 ? data.removed : "응답을 memory에 반영한 뒤 결정" },
      ]}
      explanation={
        <>
          <strong>{data.label}</strong> · query 이름보다 request와 response의 실제 type이 OGIS 대응을 결정합니다.
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="OGIS typed protocol 도식, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide ogis-protocol-svg" viewBox="0 0 900 420" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>Learner, harness, oracle, evidence memory로 이어지는 OGIS protocol</title>
          <desc id={descriptionId}>선택한 query type과 protocol 단계에 따라 request, response, evidence update를 강조합니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
            </marker>
            <marker id={accentArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-accent)" />
            </marker>
          </defs>

          <rect className="viz-lane" x="28" y="24" width="844" height="326" rx="8" />
          <line className="viz-divider" x1="236" y1="24" x2="236" y2="350" strokeDasharray="4 4" />
          <line className="viz-divider" x1="444" y1="24" x2="444" y2="350" strokeDasharray="4 4" />
          <line x1="652" y1="24" x2="652" y2="350" stroke="var(--fg-attention)" strokeDasharray="6 5" />

          {[
            { x: 48, label: "LEARNER", sub: "후보를 고름" },
            { x: 256, label: "HARNESS", sub: "typed query 구성" },
            { x: 464, label: "ORACLE", sub: "정해진 응답 반환" },
            { x: 672, label: "EVIDENCE MEMORY", sub: "다음 learner 입력" },
          ].map((lane, laneIndex) => (
            <g key={lane.label}>
              <text className="viz-eyebrow" x={lane.x} y="52">{lane.label}</text>
              <text className="viz-body" x={lane.x} y="73">{lane.sub}</text>
              {index === laneIndex ? <rect className="viz-selection-halo" x={lane.x - 8} y="88" width="184" height="224" rx="9" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
            </g>
          ))}

          <rect className={`viz-node ${index === 0 ? "viz-node-accent" : ""}`} x="48" y="102" width="168" height="102" rx="6" />
          <text className="viz-eyebrow" x="66" y="128">CANDIDATE h₁</text>
          <text className="viz-title" x="66" y="156">discount ≥ 0</text>
          <text className="viz-body" x="66" y="182">Eₜ와 일관된 첫 후보</text>

          <path className={index >= 1 ? "viz-flow viz-flow-accent" : "viz-flow"} d="M216 153 H256" markerEnd={index >= 1 ? `url(#${accentArrowId})` : `url(#${arrowId})`} />
          <rect className={`viz-node ${index === 1 ? "viz-node-accent" : ""}`} x="256" y="102" width="168" height="136" rx="6" />
          <text className="viz-eyebrow" x="274" y="128">REQUEST</text>
          <text className="viz-title" x="274" y="156">{data.label}</text>
          <text className="viz-body mono" x="274" y="184">{data.request.length > 24 ? `${data.request.slice(0, 24)}…` : data.request}</text>
          <text className="viz-body" x="274" y="216">schema로 허용 정보 제한</text>

          <path className={index >= 2 ? "viz-flow viz-flow-accent" : "viz-flow"} d="M424 170 H464" markerEnd={index >= 2 ? `url(#${accentArrowId})` : `url(#${arrowId})`} />
          <rect className={`viz-node ${index === 2 ? "viz-node-accent" : "viz-node-attention"}`} x="464" y="102" width="168" height="136" rx="6" />
          <text className="viz-eyebrow" x="482" y="128">RESPONSE</text>
          <text className="viz-title" x="482" y="156">{data.label}</text>
          <text className="viz-body mono" x="482" y="184">{data.response.length > 25 ? `${data.response.slice(0, 25)}…` : data.response}</text>
          <text className="viz-body" x="482" y="216">target 전체는 노출하지 않음</text>

          <path className={index >= 3 ? "viz-flow viz-flow-success" : "viz-flow"} d="M632 170 H672" markerEnd={`url(#${arrowId})`} />
          <rect className={`viz-node ${index === 3 ? "viz-node-success" : ""}`} x="672" y="102" width="168" height="136" rx="6" />
          <text className="viz-eyebrow" x="690" y="128">Eₜ₊₁ = UPDATE(Eₜ, rₜ)</text>
          <text className="viz-title" x="690" y="156">{data.evidence}</text>
          <text className="viz-body" x="690" y="184">version space 갱신</text>
          <text className="viz-body" x="690" y="208">Cₜ → Cₜ₊₁</text>

          <path className="viz-flow viz-flow-success" d="M756 238 V284 H132 V204" strokeDasharray="6 5" markerEnd={`url(#${arrowId})`} />
          <text className="viz-eyebrow" x="444" y="306" textAnchor="middle">NEXT ITERATION RECEIVES RETAINED EVIDENCE</text>
          <text className="viz-body" x="444" y="330" textAnchor="middle">{data.removed}가 다음 version space에서 빠집니다.</text>

          <rect className="viz-node" x="182" y="372" width="536" height="34" rx="6" />
          <text className="viz-value" x="450" y="394" textAnchor="middle">{data.request} → {data.response}</text>
        </svg>
      </div>
    </LabShell>
  );
}
