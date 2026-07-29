"use client";

import { useState } from "react";
import { LabShell, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type View = "structure" | "transition" | "markov";
type ActionId = "inspect" | "patch";
type Summary = "sufficient" | "lossy";

const VIEW_STATUS: Record<View, { label: string; question: string; unit: string }> = {
  structure: {
    label: "구조",
    question: "의사결정 문제를 어떤 요소로 적는가?",
    unit: "S, A, P, R, γ",
  },
  transition: {
    label: "한 단계 전이",
    question: "같은 state에서 action별 결과가 어떻게 갈리는가?",
    unit: "P(s′|s,a), R(s,a,s′)",
  },
  markov: {
    label: "Markov 조건",
    question: "현재 state가 다음 선택에 필요한 과거를 보존하는가?",
    unit: "P(s′|history,a) = P(s′|s,a)",
  },
};

function StructureScene({ arrowId }: { arrowId: string }) {
  const elements = [
    { symbol: "S", title: "State", body: "재현·계약·test 상태", tone: "accent" },
    { symbol: "A", title: "Action", body: "조회·patch·검증", tone: "neutral" },
    { symbol: "P", title: "Transition", body: "다음 state의 분포", tone: "attention" },
    { symbol: "R", title: "Reward", body: "성공·비용·위험", tone: "success" },
    { symbol: "γ", title: "Discount", body: "미래 결과의 비중", tone: "neutral" },
  ] as const;

  return (
    <>
      <text className="viz-eyebrow" x="42" y="42">FINITE MDP · CHECKOUT WORKFLOW</text>
      {elements.map((item, index) => {
        const x = 42 + index * 166;
        return (
          <g key={item.symbol}>
            <rect className={`viz-node ${item.tone === "neutral" ? "" : `viz-node-${item.tone}`}`} x={x} y="66" width="144" height="100" rx="6" />
            <text className="viz-value" x={x + 14} y="94">{item.symbol}</text>
            <text className="viz-title" x={x + 14} y="120">{item.title}</text>
            <text className="viz-body" x={x + 14} y="146">{item.body}</text>
          </g>
        );
      })}

      <rect className="viz-lane" x="42" y="205" width="808" height="122" rx="8" />
      <text className="viz-eyebrow" x="62" y="231">POLICY USES THE MODEL</text>
      <rect className="viz-node viz-node-accent" x="62" y="250" width="194" height="52" rx="6" />
      <text className="viz-title" x="78" y="281">s = 실패 재현</text>
      <path className="viz-flow viz-flow-accent" d="M256 276 H340" markerEnd={`url(#${arrowId})`} />
      <rect className="viz-node" x="356" y="250" width="190" height="52" rx="6" />
      <text className="viz-title" x="372" y="281">π(a|s) · 행동 선택</text>
      <path className="viz-flow" d="M546 276 H630" markerEnd={`url(#${arrowId})`} />
      <rect className="viz-node viz-node-success" x="646" y="250" width="184" height="52" rx="6" />
      <text className="viz-title" x="662" y="281">장기 return 비교</text>
      <text className="viz-body" x="450" y="357" textAnchor="middle">MDP는 loop 횟수가 아니라 action sequence의 기대 효용을 표현합니다.</text>
    </>
  );
}

function TransitionScene({ action, onAction, arrowId }: { action: ActionId; onAction: (action: ActionId) => void; arrowId: string }) {
  const inspect = action === "inspect";

  return (
    <>
      <text className="viz-eyebrow" x="42" y="42">ONE-STEP TRANSITION · SELECT AN ACTION</text>
      <rect className="viz-node viz-node-accent" x="42" y="142" width="170" height="90" rx="6" />
      <text className="viz-eyebrow" x="60" y="169">CURRENT STATE s</text>
      <text className="viz-title" x="60" y="197">실패 재현</text>
      <text className="viz-body" x="60" y="219">계약은 아직 읽지 않음</text>

      <path className={inspect ? "viz-flow viz-flow-accent" : "viz-flow"} d="M212 174 C286 174 288 104 356 104" markerEnd={`url(#${arrowId})`} />
      <path className={!inspect ? "viz-flow viz-flow-accent" : "viz-flow"} d="M212 202 C286 202 288 278 356 278" markerEnd={`url(#${arrowId})`} />

      <g
        className="viz-interactive"
        role="button"
        tabIndex={0}
        aria-label="계약 확인 action"
        aria-pressed={inspect}
        onClick={() => onAction("inspect")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onAction("inspect");
          }
        }}
      >
        {inspect ? <rect className="viz-selection-halo" x="352" y="65" width="192" height="82" rx="9" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
        <rect className={`viz-node ${inspect ? "viz-node-accent" : ""}`} x="356" y="69" width="184" height="74" rx="6" />
        <text className="viz-eyebrow" x="374" y="94">ACTION a₁</text>
        <text className="viz-title" x="374" y="121">계약 확인 · cost -1</text>
      </g>

      <g
        className="viz-interactive"
        role="button"
        tabIndex={0}
        aria-label="바로 clamp action"
        aria-pressed={!inspect}
        onClick={() => onAction("patch")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onAction("patch");
          }
        }}
      >
        {!inspect ? <rect className="viz-selection-halo" x="352" y="239" width="192" height="82" rx="9" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
        <rect className={`viz-node ${!inspect ? "viz-node-accent" : ""}`} x="356" y="243" width="184" height="74" rx="6" />
        <text className="viz-eyebrow" x="374" y="268">ACTION a₂</text>
        <text className="viz-title" x="374" y="295">바로 clamp</text>
      </g>

      <path className={inspect ? "viz-flow viz-flow-success" : "viz-flow"} d="M540 106 H648" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="590" y="94" textAnchor="middle">p=1 · r=-1</text>
      <rect className={`viz-node ${inspect ? "viz-node-success" : ""}`} x="664" y="70" width="186" height="72" rx="6" />
      <text className="viz-eyebrow" x="682" y="96">NEXT STATE s′</text>
      <text className="viz-title" x="682" y="122">계약 확인 완료</text>

      <path className={!inspect ? "viz-flow viz-flow-success" : "viz-flow"} d="M540 270 C596 270 604 224 648 224" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="596" y="247" textAnchor="middle">p=.35 · r=8</text>
      <rect className={`viz-node ${!inspect ? "viz-node-success" : ""}`} x="664" y="188" width="186" height="72" rx="6" />
      <text className="viz-eyebrow" x="682" y="214">NEXT STATE s′</text>
      <text className="viz-title" x="682" y="240">검증 완료</text>

      <path className={!inspect ? "viz-flow viz-flow-danger" : "viz-flow"} d="M540 290 C596 290 604 334 648 334" markerEnd={`url(#${arrowId})`} />
      <text className="viz-body" x="596" y="321" textAnchor="middle">p=.65 · r=-5</text>
      <rect className={`viz-node ${!inspect ? "viz-node-danger" : ""}`} x="664" y="298" width="186" height="72" rx="6" />
      <text className="viz-eyebrow" x="682" y="324">NEXT STATE s′</text>
      <text className="viz-title" x="682" y="350">계약 위반</text>
    </>
  );
}

function MarkovScene({ summary, onSummary, arrowId }: { summary: Summary; onSummary: (summary: Summary) => void; arrowId: string }) {
  const sufficient = summary === "sufficient";

  return (
    <>
      <text className="viz-eyebrow" x="42" y="42">STATE SUFFICIENCY · TWO DIFFERENT HISTORIES</text>

      <rect className="viz-node" x="42" y="76" width="222" height="98" rx="6" />
      <text className="viz-eyebrow" x="60" y="101">HISTORY h₁</text>
      <text className="viz-title" x="60" y="128">discount = 12000</text>
      <text className="viz-body" x="60" y="152">subtotal보다 큰 할인</text>

      <rect className="viz-node" x="42" y="224" width="222" height="98" rx="6" />
      <text className="viz-eyebrow" x="60" y="249">HISTORY h₂</text>
      <text className="viz-title" x="60" y="276">discount = -100</text>
      <text className="viz-body" x="60" y="300">음수 할인</text>

      <path className="viz-flow" d={sufficient ? "M264 125 H376" : "M264 125 C330 125 330 199 390 199"} markerEnd={`url(#${arrowId})`} />
      <path className="viz-flow" d={sufficient ? "M264 273 H376" : "M264 273 C330 273 330 199 390 199"} markerEnd={`url(#${arrowId})`} />

      {sufficient ? (
        <>
          <rect className="viz-node viz-node-accent" x="392" y="86" width="230" height="78" rx="6" />
          <text className="viz-eyebrow" x="410" y="111">STATE s₁</text>
          <text className="viz-title" x="410" y="138">failureKind: upper-bound</text>
          <rect className="viz-node viz-node-accent" x="392" y="234" width="230" height="78" rx="6" />
          <text className="viz-eyebrow" x="410" y="259">STATE s₂</text>
          <text className="viz-title" x="410" y="286">failureKind: lower-bound</text>
          <path className="viz-flow viz-flow-success" d="M622 125 H690" markerEnd={`url(#${arrowId})`} />
          <path className="viz-flow viz-flow-success" d="M622 273 H690" markerEnd={`url(#${arrowId})`} />
          <rect className="viz-node viz-node-success" x="706" y="86" width="144" height="78" rx="6" />
          <text className="viz-eyebrow" x="724" y="111">NEXT ACTION</text>
          <text className="viz-title" x="724" y="138">상한 validator</text>
          <rect className="viz-node viz-node-success" x="706" y="234" width="144" height="78" rx="6" />
          <text className="viz-eyebrow" x="724" y="259">NEXT ACTION</text>
          <text className="viz-title" x="724" y="286">하한 validator</text>
        </>
      ) : (
        <>
          <rect className="viz-node viz-node-danger" x="406" y="150" width="230" height="98" rx="6" />
          <text className="viz-eyebrow" x="424" y="177">LOSSY STATE s</text>
          <text className="viz-title" x="424" y="205">contractPassing: false</text>
          <text className="viz-body" x="424" y="229">실패 입력 정보가 사라짐</text>
          <path className="viz-flow viz-flow-danger" d="M636 199 H704" markerEnd={`url(#${arrowId})`} />
          <rect className="viz-node viz-node-danger" x="720" y="150" width="130" height="98" rx="6" />
          <text className="viz-eyebrow" x="738" y="177">AMBIGUOUS</text>
          <text className="viz-title" x="738" y="205">어느 경계?</text>
          <text className="viz-body" x="738" y="229">행동을 못 정함</text>
        </>
      )}

      <g
        className="viz-interactive"
        role="button"
        tabIndex={0}
        aria-label={sufficient ? "실패 입력을 제외한 state로 전환" : "실패 입력을 보존한 state로 전환"}
        aria-pressed={sufficient}
        onClick={() => onSummary(sufficient ? "lossy" : "sufficient")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSummary(sufficient ? "lossy" : "sufficient");
          }
        }}
      >
        <rect x="296" y="333" width="308" height="58" rx="8" fill="transparent" />
        <rect className="viz-node" x="296" y="342" width="308" height="40" rx="6" />
        <text className="viz-body" x="450" y="367" textAnchor="middle">
          클릭해서 state summary를 {sufficient ? "정보 손실 상태로" : "충분한 상태로"} 바꾸기
        </text>
      </g>
    </>
  );
}

export function MdpStructureExplorer() {
  const [view, setView] = useState<View>("structure");
  const [action, setAction] = useState<ActionId>("inspect");
  const [summary, setSummary] = useState<Summary>("sufficient");
  const current = VIEW_STATUS[view];
  const svgPrefix = useSvgIdPrefix("mdp-concept");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;

  function reset() {
    setView("structure");
    setAction("inspect");
    setSummary("sufficient");
  }

  return (
    <LabShell
      title="결제 API 작업을 MDP 요소로 나누기"
      subtitle="State, action, transition, reward와 Markov 조건이 수정 workflow에서 무엇을 가리키는지 확인합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <>
          <SegmentedControl<View>
            label="살펴볼 장면"
            value={view}
            options={[
              { value: "structure", label: "구조" },
              { value: "transition", label: "한 단계 전이" },
              { value: "markov", label: "Markov 조건" },
            ]}
            onChange={setView}
          />
          {view === "transition" ? (
            <SegmentedControl<ActionId>
              label="선택 action"
              value={action}
              options={[
                { value: "inspect", label: "계약 확인" },
                { value: "patch", label: "바로 clamp" },
              ]}
              onChange={setAction}
            />
          ) : null}
          {view === "markov" ? (
            <SegmentedControl<Summary>
              label="State summary"
              value={summary}
              options={[
                { value: "sufficient", label: "실패 입력 보존" },
                { value: "lossy", label: "boolean만 보존" },
              ]}
              onChange={setSummary}
            />
          ) : null}
        </>
      }
      stageLabel={`MDP · ${current.label}`}
      legend={[
        { label: "현재 선택", tone: "accent" },
        { label: "좋은 결과", tone: "success" },
        { label: "정보 손실·실패", tone: "danger" },
      ]}
      status={[
        { label: "질문", value: current.question },
        { label: "수학적 단위", value: current.unit },
        {
          label: "현재 결론",
          value:
            view === "markov"
              ? summary === "sufficient"
                ? "state가 행동을 구분함"
                : "state 보강이 필요함"
              : view === "transition"
                ? action === "inspect"
                  ? "확실한 조사 경로"
                  : "성공·실패로 분기"
                : "모형과 해법을 구분",
        },
      ]}
      explanation={
        <>
          <strong>{current.label}</strong> ·{" "}
          {view === "structure"
            ? "S, A, P, R, γ는 환경 모형의 구성요소이며 policy나 Bellman backup 같은 해법과 구분합니다."
            : view === "transition"
              ? action === "inspect"
                ? "계약 확인은 이 예시에서 성공 상태로 이어지는 확실한 조사 경로입니다."
                : "즉시 clamp는 illustrative 확률에 따라 성공과 계약 위반으로 갈립니다."
              : summary === "sufficient"
                ? "실패 입력을 보존한 state는 다음 행동에 필요한 차이를 유지합니다."
                : "boolean만 남기면 다음 전이를 예측할 정보가 부족해 state를 보강해야 합니다."}
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="MDP 구조 설명 도식, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide mdp-concept-svg" viewBox="0 0 900 410" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>MDP의 구조, 전이, Markov 조건</title>
          <desc id={descriptionId}>선택한 장면에 따라 MDP의 다섯 요소, action별 확률 전이, state summary의 충분성을 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
            </marker>
          </defs>
          {view === "structure" ? <StructureScene arrowId={arrowId} /> : null}
          {view === "transition" ? <TransitionScene action={action} onAction={setAction} arrowId={arrowId} /> : null}
          {view === "markov" ? <MarkovScene summary={summary} onSummary={setSummary} arrowId={arrowId} /> : null}
        </svg>
      </div>
    </LabShell>
  );
}
