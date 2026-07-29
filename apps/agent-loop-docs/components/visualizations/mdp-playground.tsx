"use client";

import { IterationCw, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { LabShell, RangeControl, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type StateId = "start" | "safe" | "risk" | "goal";
type Values = Record<StateId, number>;

type Transition = {
  to: StateId;
  probability: number;
  reward: number;
};

type Action = {
  id: string;
  label: string;
  transitions: Transition[];
};

const STATES: Array<{ id: StateId; label: string; x: number; y: number }> = [
  { id: "start", label: "실패 재현", x: 118, y: 216 },
  { id: "safe", label: "계약 확인", x: 360, y: 112 },
  { id: "risk", label: "패치 실패", x: 360, y: 316 },
  { id: "goal", label: "검증 완료", x: 592, y: 216 },
];

const ACTIONS: Record<StateId, Action[]> = {
  start: [
    {
      id: "steady",
      label: "계약 확인",
      transitions: [{ to: "safe", probability: 1, reward: -1 }],
    },
    {
      id: "shortcut",
      label: "바로 clamp",
      transitions: [
        { to: "goal", probability: 0.35, reward: 8 },
        { to: "risk", probability: 0.65, reward: -5 },
      ],
    },
  ],
  safe: [
    {
      id: "advance",
      label: "검증 추가",
      transitions: [
        { to: "goal", probability: 0.85, reward: 7 },
        { to: "safe", probability: 0.15, reward: -1 },
      ],
    },
    {
      id: "wait",
      label: "코드만 수정",
      transitions: [
        { to: "goal", probability: 0.55, reward: 5 },
        { to: "risk", probability: 0.45, reward: -4 },
      ],
    },
  ],
  risk: [
    {
      id: "recover",
      label: "반례 확인",
      transitions: [
        { to: "safe", probability: 0.8, reward: 0 },
        { to: "risk", probability: 0.2, reward: -2 },
      ],
    },
    {
      id: "gamble",
      label: "다시 patch",
      transitions: [
        { to: "goal", probability: 0.4, reward: 6 },
        { to: "risk", probability: 0.6, reward: -5 },
      ],
    },
  ],
  goal: [],
};

const INITIAL_VALUES: Values = { start: 0, safe: 0, risk: 0, goal: 0 };

function qValue(action: Action, values: Values, gamma: number) {
  return action.transitions.reduce(
    (sum, transition) => sum + transition.probability * (transition.reward + gamma * values[transition.to]),
    0,
  );
}

function bellmanBackup(values: Values, gamma: number): Values {
  return {
    start: Math.max(...ACTIONS.start.map((action) => qValue(action, values, gamma))),
    safe: Math.max(...ACTIONS.safe.map((action) => qValue(action, values, gamma))),
    risk: Math.max(...ACTIONS.risk.map((action) => qValue(action, values, gamma))),
    goal: 0,
  };
}

function format(value: number) {
  return value.toFixed(2);
}

function nodeFill(selected: boolean) {
  return selected ? "var(--bg-accent-muted)" : "var(--bg-canvas)";
}

export function MdpPlayground() {
  const [gamma, setGamma] = useState(0.9);
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [selectedState, setSelectedState] = useState<StateId>("start");
  const [iteration, setIteration] = useState(0);
  const [lastTransition, setLastTransition] = useState("아직 action을 실행하지 않았습니다.");
  const seedRef = useRef(17);
  const svgPrefix = useSvgIdPrefix("mdp-playground");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;
  const accentArrowId = `${svgPrefix}-arrow-accent`;

  const stateActions = ACTIONS[selectedState];
  const actionScores = useMemo(
    () => stateActions.map((action) => ({ action, value: qValue(action, values, gamma) })),
    [gamma, stateActions, values],
  );
  const bestAction = actionScores.length
    ? actionScores.reduce((best, current) => (current.value > best.value ? current : best))
    : null;
  const nextValues = useMemo(() => bellmanBackup(values, gamma), [gamma, values]);

  function iterate() {
    setValues((current) => bellmanBackup(current, gamma));
    setIteration((current) => current + 1);
  }

  function execute(action: Action) {
    seedRef.current = (seedRef.current * 9301 + 49297) % 233280;
    const sample = seedRef.current / 233280;
    let cumulative = 0;
    const transition =
      action.transitions.find((candidate) => {
        cumulative += candidate.probability;
        return sample <= cumulative;
      }) ?? action.transitions[action.transitions.length - 1];

    const from = STATES.find((state) => state.id === selectedState)?.label ?? selectedState;
    const to = STATES.find((state) => state.id === transition.to)?.label ?? transition.to;
    setSelectedState(transition.to);
    setLastTransition(`${from} --${action.label} / r=${transition.reward}--> ${to}`);
  }

  function reset() {
    setGamma(0.9);
    setValues(INITIAL_VALUES);
    setSelectedState("start");
    setIteration(0);
    setLastTransition("아직 action을 실행하지 않았습니다.");
    seedRef.current = 17;
  }

  const maxDelta = Math.max(
    ...Object.keys(values).map((key) => {
      const id = key as StateId;
      return Math.abs(nextValues[id] - values[id]);
    }),
  );

  return (
    <LabShell
      title="계약 확인과 즉시 수정의 장기 가치 비교"
      subtitle="Bellman backup으로 조사 비용과 이후 회귀 위험을 함께 계산합니다."
      actions={
        <>
          <button className="lab-button primary" type="button" onClick={iterate}>
            <IterationCw aria-hidden="true" size={15} />
            Bellman 1회
          </button>
          <ResetButton onClick={reset} />
        </>
      }
      controls={
        <>
          <SegmentedControl<StateId>
            label="분석할 state"
            value={selectedState}
            options={STATES.map((state) => ({ value: state.id, label: state.label }))}
            onChange={setSelectedState}
          />
          <RangeControl
            id="mdp-gamma"
            label="Discount factor"
            value={gamma}
            min={0}
            max={0.99}
            step={0.01}
            valueLabel={`γ ${gamma.toFixed(2)}`}
            onChange={setGamma}
          />
          <div className="control-group">
            <span className="control-label">Action 실행</span>
            <div className="lab-action-row">
              {stateActions.length ? (
                stateActions.map((action) => (
                  <button className="lab-button" type="button" key={action.id} onClick={() => execute(action)}>
                    <Play aria-hidden="true" size={13} />
                    {action.label}
                  </button>
                ))
              ) : (
                <button className="lab-button" type="button" onClick={() => setSelectedState("start")}>
                  실패 재현으로
                </button>
              )}
            </div>
          </div>
        </>
      }
      stageLabel="Illustrative state transition graph · assumed p/r"
      legend={[
        { label: "현재 state", tone: "accent" },
        { label: "성공 경로", tone: "success" },
        { label: "실패 경로", tone: "danger" },
      ]}
      status={[
        { label: "Iteration", value: String(iteration) },
        { label: "Max delta", value: format(maxDelta) },
        { label: "Greedy action", value: bestAction?.action.label ?? "terminal" },
      ]}
      explanation={
        <>
          최근 transition: <strong>{lastTransition}</strong> · 확률과 reward는 장기 가치 계산을 설명하기 위한 illustrative assumption입니다.
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="MDP 상태 전이 그래프, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide mdp-svg" viewBox="0 0 900 430" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>결제 API 수정 workflow의 네 상태와 Bellman value</title>
          <desc id={descriptionId}>실패 재현, 계약 확인, patch 실패, 검증 완료 상태 사이의 확률 전이와 선택한 상태의 action value를 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--line-strong)" />
            </marker>
            <marker id={accentArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-accent)" />
            </marker>
          </defs>

          <g className="mdp-edges" fill="none" strokeWidth="2">
            <path className="viz-edge" d="M160 191 C220 145 272 120 317 114" stroke="var(--fg-accent)" markerEnd={`url(#${accentArrowId})`} />
            <text x="226" y="134" textAnchor="middle" fontSize="11">계약 확인  p=1 · r=-1</text>
            <path d="M162 225 C280 255 448 255 548 225" stroke="var(--line-strong)" markerEnd={`url(#${arrowId})`} />
            <text x="356" y="251" textAnchor="middle" fontSize="11">바로 clamp  p=.35 · r=8</text>
            <path className="viz-edge" d="M152 243 C212 292 269 313 316 316" stroke="var(--fg-danger)" markerEnd={`url(#${arrowId})`} />
            <text x="223" y="300" textAnchor="middle" fontSize="11">계약 실패  p=.65 · r=-5</text>
            <path className="viz-edge" d="M403 128 C462 145 510 176 552 204" stroke="var(--fg-success)" markerEnd={`url(#${arrowId})`} />
            <text x="479" y="152" textAnchor="middle" fontSize="11">검증 추가  p=.85 · r=7</text>
            <path className="viz-edge" d="M402 300 C461 278 512 247 552 226" stroke="var(--fg-attention)" markerEnd={`url(#${arrowId})`} />
            <text x="484" y="292" textAnchor="middle" fontSize="11">다시 patch  p=.4 · r=6</text>
            <path d="M365 273 C364 232 364 194 364 156" stroke="var(--line-strong)" markerEnd={`url(#${arrowId})`} />
            <text x="386" y="218" fontSize="11">반례 확인  p=.8</text>
            <path d="M340 76 C286 46 300 22 360 22 C420 22 438 50 392 78" stroke="var(--line-strong)" markerEnd={`url(#${arrowId})`} />
            <text x="360" y="14" textAnchor="middle" fontSize="10">stay  p=.15</text>
            <path d="M340 352 C286 382 300 406 360 406 C420 406 438 378 392 350" stroke="var(--line-strong)" markerEnd={`url(#${arrowId})`} />
            <text x="360" y="424" textAnchor="middle" fontSize="10">remain  p=.2/.6</text>
          </g>

          {STATES.map((state) => {
            const selected = selectedState === state.id;
            return (
              <g
                key={state.id}
                className={selected ? "mdp-node is-selected" : "mdp-node"}
                transform={`translate(${state.x} ${state.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${state.label} 상태, 가치 ${format(values[state.id])}`}
                aria-pressed={selected}
                onClick={() => setSelectedState(state.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedState(state.id);
                  }
                }}
              >
                {selected ? <circle className="viz-selection-halo" r="47" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
                <circle className="viz-shape" r="43" fill={nodeFill(selected)} stroke="var(--border-emphasis)" strokeWidth="1.5" />
                <text y="-5" textAnchor="middle" fontSize="12" fontWeight="700">{state.label}</text>
                <text className="mono" y="17" textAnchor="middle" fontSize="11" fill={selected ? "var(--fg-accent)" : "var(--fg-muted)"}>V {format(values[state.id])}</text>
              </g>
            );
          })}

          <g className="mdp-q-panel">
            <rect x="662" y="36" width="210" height="358" rx="7" fill="var(--surface-subtle)" stroke="var(--line)" />
            <text x="682" y="67" fontSize="10" className="muted-text mono">ACTION VALUE</text>
            <text x="682" y="94" fontSize="17" fontWeight="760">{STATES.find((state) => state.id === selectedState)?.label}</text>
            <line x1="682" y1="112" x2="852" y2="112" stroke="var(--line)" />
            {actionScores.length ? (
              actionScores.map(({ action, value }, index) => {
                const best = bestAction?.action.id === action.id;
                const y = 148 + index * 76;
                return (
                  <g key={action.id}>
                    <text x="682" y={y} fontSize="12" fontWeight="700" fill={best ? "var(--fg-accent)" : "var(--ink-soft)"}>{action.label}</text>
                    <text x="852" y={y} textAnchor="end" className="mono" fontSize="12" fill={best ? "var(--fg-accent)" : "var(--ink-soft)"}>Q {format(value)}</text>
                    <rect x="682" y={y + 14} width="170" height="6" rx="3" fill="var(--line)" />
                    <rect x="682" y={y + 14} width={Math.max(8, Math.min(170, 24 + Math.max(0, value) * 15))} height="6" rx="3" fill={best ? "var(--fg-accent)" : "var(--line-strong)"} />
                    <text x="682" y={y + 42} className="muted-text mono" fontSize="9">
                      Σ P(s&apos;|s,a)[r + γV(s&apos;)]
                    </text>
                  </g>
                );
              })
            ) : (
              <>
                <text x="682" y="154" fontSize="13">terminal state</text>
                <text x="682" y="181" className="muted-text" fontSize="11">V(goal) = 0</text>
              </>
            )}
            <line x1="682" y1="316" x2="852" y2="316" stroke="var(--line)" />
            <text x="682" y="344" className="muted-text mono" fontSize="9">BELLMAN OPTIMALITY</text>
            <text x="682" y="369" className="mono" fontSize="11">V(s) ← max Q(s,a)</text>
          </g>
        </svg>
      </div>
    </LabShell>
  );
}
