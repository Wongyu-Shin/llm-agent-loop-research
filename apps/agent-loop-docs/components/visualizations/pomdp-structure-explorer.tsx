"use client";

import { useMemo, useState } from "react";
import { LabShell, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type View = "structure" | "filter" | "planning";
type TestAction = "unit" | "contract";
type Observation = "fail" | "pass";
type Horizon = "one" | "two";

const FAILURE_LIKELIHOOD: Record<TestAction, { validation: number; formula: number }> = {
  unit: { validation: 0.3, formula: 0.85 },
  contract: { validation: 0.92, formula: 0.35 },
};

const VIEW_STATUS: Record<View, { label: string; question: string; unit: string }> = {
  structure: {
    label: "관측 구조",
    question: "무엇이 숨겨져 있고 무엇을 실제로 읽는가?",
    unit: "S, A, T, Ω, O, b",
  },
  filter: {
    label: "Belief update",
    question: "선택한 test와 결과가 원인 확률을 어떻게 바꾸는가?",
    unit: "b′(s) ∝ O(o|s,a)b(s)",
  },
  planning: {
    label: "Online planning",
    question: "Belief update 뒤 미래 observation까지 분기하는가?",
    unit: "belief-action-observation tree",
  },
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function StructureScene({ arrowId }: { arrowId: string }) {
  return (
    <>
      <rect className="viz-lane" x="34" y="42" width="832" height="156" rx="8" />
      <text className="viz-eyebrow" x="54" y="69">ENVIRONMENT · HIDDEN</text>
      <rect className="viz-node viz-node-attention" x="70" y="96" width="182" height="72" rx="6" />
      <text className="viz-eyebrow" x="88" y="121">HIDDEN STATE Sₜ</text>
      <text className="viz-title" x="88" y="148">실제 결함 원인</text>
      <path className="viz-flow" d="M252 132 H358" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="305" y="118" textAnchor="middle">T(s′|s,a)</text>
      <rect className="viz-node viz-node-attention" x="374" y="96" width="182" height="72" rx="6" />
      <text className="viz-eyebrow" x="392" y="121">NEXT STATE Sₜ₊₁</text>
      <text className="viz-title" x="392" y="148">patch 뒤 시스템</text>
      <path className="viz-flow viz-flow-attention" d="M556 132 H662" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="609" y="118" textAnchor="middle">O(o|s′,a)</text>
      <rect className="viz-node" x="678" y="96" width="152" height="72" rx="6" />
      <text className="viz-eyebrow" x="696" y="121">OBSERVATION Ω</text>
      <text className="viz-title" x="696" y="148">log · pass/fail</text>

      <rect className="viz-lane" x="34" y="224" width="832" height="142" rx="8" />
      <text className="viz-eyebrow" x="54" y="251">AGENT · OBSERVABLE HISTORY</text>
      <rect className="viz-node viz-node-accent" x="70" y="278" width="182" height="62" rx="6" />
      <text className="viz-eyebrow" x="88" y="302">BELIEF bₜ</text>
      <text className="viz-title" x="88" y="326">원인 확률분포</text>
      <path className="viz-flow viz-flow-accent" d="M252 309 H358" markerEnd={`url(#${arrowId})`} />
      <rect className="viz-node" x="374" y="278" width="182" height="62" rx="6" />
      <text className="viz-eyebrow" x="392" y="302">ACTION A</text>
      <text className="viz-title" x="392" y="326">test · 조회 · patch</text>
      <path className="viz-flow viz-flow-accent" d="M556 309 H662" markerEnd={`url(#${arrowId})`} />
      <rect className="viz-node viz-node-success" x="678" y="278" width="152" height="62" rx="6" />
      <text className="viz-eyebrow" x="696" y="302">UPDATED bₜ₊₁</text>
      <text className="viz-title" x="696" y="326">다음 선택의 state</text>

      <path className="viz-flow viz-flow-accent" d="M465 278 V190" strokeDasharray="6 5" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="482" y="218">action이 transition과 sensor에 영향</text>
      <path className="viz-flow viz-flow-success" d="M754 168 V278" strokeDasharray="6 5" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="770" y="219">observation으로 보정</text>
    </>
  );
}

function FilterScene({
  action,
  observation,
  posterior,
  arrowId,
}: {
  action: TestAction;
  observation: Observation;
  posterior: number;
  arrowId: string;
}) {
  const failure = FAILURE_LIKELIHOOD[action];
  const likelihoodValidation = observation === "fail" ? failure.validation : 1 - failure.validation;
  const likelihoodFormula = observation === "fail" ? failure.formula : 1 - failure.formula;

  return (
    <>
      <text className="viz-eyebrow" x="42" y="42">DIAGNOSTIC ACTION · SAME PRIOR 50 / 50</text>
      <rect className="viz-node viz-node-accent" x="42" y="88" width="202" height="92" rx="6" />
      <text className="viz-eyebrow" x="60" y="115">HYPOTHESIS s₁</text>
      <text className="viz-title" x="60" y="143">입력 검증 누락</text>
      <text className="viz-value" x="60" y="167">prior 50%</text>
      <rect className="viz-node viz-node-attention" x="42" y="232" width="202" height="92" rx="6" />
      <text className="viz-eyebrow" x="60" y="259">HYPOTHESIS s₂</text>
      <text className="viz-title" x="60" y="287">계산식 결함</text>
      <text className="viz-value" x="60" y="311">prior 50%</text>

      <path className="viz-flow viz-flow-accent" d="M244 134 C322 134 324 186 380 186" strokeWidth={2 + likelihoodValidation * 10} />
      <text className="viz-body" x="304" y="119" textAnchor="middle">likelihood {likelihoodValidation.toFixed(2)}</text>
      <path className="viz-flow viz-flow-attention" d="M244 278 C322 278 324 220 380 220" strokeWidth={2 + likelihoodFormula * 10} />
      <text className="viz-body" x="304" y="302" textAnchor="middle">likelihood {likelihoodFormula.toFixed(2)}</text>

      <rect className="viz-node" x="380" y="142" width="210" height="122" rx="6" />
      <text className="viz-eyebrow" x="400" y="169">ACTION + OBSERVATION</text>
      <text className="viz-title" x="400" y="198">{action === "contract" ? "Contract test" : "경계값 unit test"}</text>
      <line className="viz-divider" x1="400" y1="213" x2="570" y2="213" />
      <text className="viz-title" x="400" y="242">{observation === "fail" ? "FAIL" : "PASS"}</text>

      <path className="viz-flow" d="M590 203 H666" markerEnd={`url(#${arrowId})`} />
      <rect className="viz-node" x="682" y="76" width="176" height="256" rx="6" />
      <rect x="682" y="76" width="176" height={256 * posterior} rx="6" fill="var(--bg-accent-muted)" />
      <line className="viz-divider" x1="682" y1={76 + 256 * posterior} x2="858" y2={76 + 256 * posterior} />
      <text className="viz-eyebrow" x="702" y="108">POSTERIOR b′</text>
      <text className="viz-title" x="702" y="138">검증 누락 {percent(posterior)}</text>
      <text className="viz-title" x="702" y="302">계산 결함 {percent(1 - posterior)}</text>
      <text className="viz-body" x="450" y="372" textAnchor="middle">관찰값만이 아니라 어떤 action으로 관찰했는지가 likelihood를 정합니다.</text>
    </>
  );
}

function PlanningScene({ horizon, arrowId }: { horizon: Horizon; arrowId: string }) {
  const deep = horizon === "two";

  return (
    <>
      <text className="viz-eyebrow" x="42" y="42">BELIEF-ACTION-OBSERVATION TREE · ILLUSTRATIVE VALUES</text>
      <rect className="viz-node viz-node-accent" x="42" y="156" width="156" height="82" rx="6" />
      <text className="viz-eyebrow" x="60" y="183">CURRENT BELIEF</text>
      <text className="viz-title" x="60" y="211">b(validation)=.50</text>
      <path className="viz-flow viz-flow-accent" d="M198 180 C256 180 254 110 310 110" markerEnd={`url(#${arrowId})`} />
      <path className="viz-flow" d="M198 214 C256 214 254 282 310 282" markerEnd={`url(#${arrowId})`} />

      <rect className="viz-node viz-node-accent" x="326" y="72" width="160" height="72" rx="6" />
      <text className="viz-eyebrow" x="344" y="98">ACTION a₁</text>
      <text className="viz-title" x="344" y="124">Contract test</text>
      <rect className="viz-node" x="326" y="246" width="160" height="72" rx="6" />
      <text className="viz-eyebrow" x="344" y="272">ACTION a₂</text>
      <text className="viz-title" x="344" y="298">경계값 unit</text>

      <path className="viz-flow viz-flow-success" d="M486 96 H576" markerEnd={`url(#${arrowId})`} />
      <path className="viz-flow viz-flow-danger" d="M486 120 C536 120 536 174 576 174" markerEnd={`url(#${arrowId})`} />
      <path className="viz-flow" d="M486 270 C536 270 536 222 576 222" markerEnd={`url(#${arrowId})`} />
      <path className="viz-flow" d="M486 294 H576" markerEnd={`url(#${arrowId})`} />

      {[
        { y: 70, label: "PASS", belief: "b′=.11", tone: "success" },
        { y: 148, label: "FAIL", belief: "b′=.72", tone: "danger" },
        { y: 196, label: "PASS", belief: "b′=.82", tone: "neutral" },
        { y: 270, label: "FAIL", belief: "b′=.26", tone: "neutral" },
      ].map((item) => (
        <g key={`${item.label}-${item.y}`}>
          <rect className={`viz-node ${item.tone === "neutral" ? "" : `viz-node-${item.tone}`}`} x="592" y={item.y} width="126" height="52" rx="6" />
          <text className="viz-eyebrow" x="608" y={item.y + 21}>{item.label}</text>
          <text className="viz-value" x="608" y={item.y + 41}>{item.belief}</text>
        </g>
      ))}

      {deep ? (
        <>
          <path className="viz-flow viz-flow-accent" d="M718 96 H770" markerEnd={`url(#${arrowId})`} />
          <path className="viz-flow viz-flow-accent" d="M718 174 H770" markerEnd={`url(#${arrowId})`} />
          <path className="viz-flow" d="M718 222 H770" markerEnd={`url(#${arrowId})`} />
          <path className="viz-flow" d="M718 296 H770" markerEnd={`url(#${arrowId})`} />
          <rect className="viz-node viz-node-success" x="786" y="68" width="72" height="254" rx="6" />
          <text className="viz-eyebrow" x="822" y="101" textAnchor="middle">BACKUP</text>
          <text className="viz-title" x="822" y="132" textAnchor="middle">rollout</text>
          <text className="viz-body" x="822" y="158" textAnchor="middle">patch</text>
          <text className="viz-body" x="822" y="178" textAnchor="middle">검증</text>
          <text className="viz-body" x="822" y="198" textAnchor="middle">cost</text>
          <line className="viz-divider" x1="800" y1="222" x2="844" y2="222" />
          <text className="viz-value" x="822" y="250" textAnchor="middle">V(b)</text>
          <text className="viz-body" x="822" y="279" textAnchor="middle">장기값</text>
        </>
      ) : (
        <>
          <path className="viz-flow" d="M718 196 H770" markerEnd={`url(#${arrowId})`} />
          <rect className="viz-node viz-node-attention" x="786" y="154" width="72" height="84" rx="6" />
          <text className="viz-eyebrow" x="822" y="181" textAnchor="middle">STOP</text>
          <text className="viz-title" x="822" y="207" textAnchor="middle">b′</text>
          <text className="viz-body" x="822" y="226" textAnchor="middle">추정만</text>
        </>
      )}

      <text className="viz-body" x="450" y="370" textAnchor="middle">
        {deep ? "Planner는 가능한 observation 뒤의 후속 행동과 장기 value를 비교합니다." : "Posterior 하나를 계산했다고 planning이 끝난 것은 아닙니다."}
      </text>
    </>
  );
}

export function PomdpStructureExplorer() {
  const [view, setView] = useState<View>("structure");
  const [action, setAction] = useState<TestAction>("contract");
  const [observation, setObservation] = useState<Observation>("fail");
  const [horizon, setHorizon] = useState<Horizon>("one");
  const svgPrefix = useSvgIdPrefix("pomdp-concept");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;

  const posterior = useMemo(() => {
    const failure = FAILURE_LIKELIHOOD[action];
    const likelihoodValidation = observation === "fail" ? failure.validation : 1 - failure.validation;
    const likelihoodFormula = observation === "fail" ? failure.formula : 1 - failure.formula;
    return likelihoodValidation / (likelihoodValidation + likelihoodFormula);
  }, [action, observation]);

  const current = VIEW_STATUS[view];

  function reset() {
    setView("structure");
    setAction("contract");
    setObservation("fail");
    setHorizon("one");
  }

  return (
    <LabShell
      title="결함 원인과 테스트 결과를 분리하는 POMDP"
      subtitle="Hidden state에서 observation이 나오고 belief가 갱신된 뒤 planning으로 이어지는 경계를 확인합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <>
          <SegmentedControl<View>
            label="살펴볼 장면"
            value={view}
            options={[
              { value: "structure", label: "관측 구조" },
              { value: "filter", label: "Belief update" },
              { value: "planning", label: "Planning 경계" },
            ]}
            onChange={setView}
          />
          {view === "filter" ? (
            <>
              <SegmentedControl<TestAction>
                label="Test action"
                value={action}
                options={[
                  { value: "unit", label: "경계값 unit" },
                  { value: "contract", label: "Contract" },
                ]}
                onChange={setAction}
              />
              <SegmentedControl<Observation>
                label="Observation"
                value={observation}
                options={[
                  { value: "fail", label: "Fail" },
                  { value: "pass", label: "Pass" },
                ]}
                onChange={setObservation}
              />
            </>
          ) : null}
          {view === "planning" ? (
            <SegmentedControl<Horizon>
              label="계산 범위"
              value={horizon}
              options={[
                { value: "one", label: "Posterior까지만" },
                { value: "two", label: "후속 행동 rollout" },
              ]}
              onChange={setHorizon}
            />
          ) : null}
        </>
      }
      stageLabel={`POMDP · ${current.label} · illustrative checkout model`}
      legend={[
        { label: "belief·선택", tone: "accent" },
        { label: "hidden state", tone: "attention" },
        { label: "observation·검증", tone: "success" },
      ]}
      status={[
        { label: "질문", value: current.question },
        { label: "수학적 단위", value: current.unit },
        {
          label: "현재 결론",
          value:
            view === "filter"
              ? `P(validation|o) ${percent(posterior)}`
              : view === "planning"
                ? horizon === "two"
                  ? "분기와 value backup 포함"
                  : "state estimation만 수행"
                : "state와 observation 분리",
        },
      ]}
      explanation={
        <>
          <strong>Illustrative model</strong> · filter likelihood와 planning rollout value는 POMDP의 계산 구조를 설명하기 위한 가정값이며 실제 checkout 통계가 아닙니다.
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="POMDP 구조 설명 도식, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide pomdp-concept-svg" viewBox="0 0 900 410" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>POMDP의 관측 구조, belief update, planning 경계</title>
          <desc id={descriptionId}>선택한 장면에 따라 숨은 상태와 관찰의 관계, Bayes update, belief-action-observation tree를 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
            </marker>
          </defs>
          {view === "structure" ? <StructureScene arrowId={arrowId} /> : null}
          {view === "filter" ? <FilterScene action={action} observation={observation} posterior={posterior} arrowId={arrowId} /> : null}
          {view === "planning" ? <PlanningScene horizon={horizon} arrowId={arrowId} /> : null}
        </svg>
      </div>
    </LabShell>
  );
}
