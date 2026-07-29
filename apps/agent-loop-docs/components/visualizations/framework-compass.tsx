"use client";

import { useId, useState, type KeyboardEvent } from "react";
import {
  LabShell,
  ResetButton,
  SegmentedControl,
} from "@/components/visualizations/viz-shell";

type StateSignal = "full" | "hidden";
type QuerySignal = "untyped" | "typed";
type CounterexampleSignal = "none" | "concrete";
type DecisionLens = "MDP" | "POMDP";
type SynthesisLens = "OGIS" | "CEGIS" | "판별 보류";

const INITIAL_STATE: StateSignal = "hidden";
const INITIAL_QUERY: QuerySignal = "typed";
const INITIAL_COUNTEREXAMPLE: CounterexampleSignal = "concrete";

function activateOnKey(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

export function FrameworkCompass() {
  const [stateSignal, setStateSignal] =
    useState<StateSignal>(INITIAL_STATE);
  const [querySignal, setQuerySignal] =
    useState<QuerySignal>(INITIAL_QUERY);
  const [counterexampleSignal, setCounterexampleSignal] =
    useState<CounterexampleSignal>(INITIAL_COUNTEREXAMPLE);

  const reactId = useId().replace(/:/g, "");
  const titleId = `framework-compass-title-${reactId}`;
  const descriptionId = `framework-compass-desc-${reactId}`;
  const arrowId = `framework-compass-arrow-${reactId}`;
  const accentArrowId = `framework-compass-accent-arrow-${reactId}`;

  const decisionLens: DecisionLens =
    stateSignal === "full" ? "MDP" : "POMDP";
  const synthesisLens: SynthesisLens =
    counterexampleSignal === "concrete"
      ? "CEGIS"
      : querySignal === "typed"
        ? "OGIS"
        : "판별 보류";

  function chooseQuerySignal(next: QuerySignal) {
    setQuerySignal(next);
    if (next === "untyped") {
      setCounterexampleSignal("none");
    }
  }

  function chooseCounterexampleSignal(next: CounterexampleSignal) {
    setCounterexampleSignal(next);
    if (next === "concrete") {
      setQuerySignal("typed");
    }
  }

  function chooseOgis() {
    setQuerySignal("typed");
    setCounterexampleSignal("none");
  }

  function chooseCegis() {
    setQuerySignal("typed");
    setCounterexampleSignal("concrete");
  }

  function reset() {
    setStateSignal(INITIAL_STATE);
    setQuerySignal(INITIAL_QUERY);
    setCounterexampleSignal(INITIAL_COUNTEREXAMPLE);
  }

  return (
    <LabShell
      title="구현 신호로 고르는 agent-loop framework compass"
      subtitle="환경에서 다음 행동을 고르는 질문과 검증으로 다음 후보를 만드는 질문을 두 개의 독립 track으로 살펴봅니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <>
          <SegmentedControl<StateSignal>
            label="Environment state"
            value={stateSignal}
            options={[
              { value: "full", label: "충분히 관측" },
              { value: "hidden", label: "숨은 state" },
            ]}
            onChange={setStateSignal}
          />
          <SegmentedControl<QuerySignal>
            label="Oracle query"
            value={querySignal}
            options={[
              { value: "untyped", label: "형식 없음" },
              { value: "typed", label: "Typed query" },
            ]}
            onChange={chooseQuerySignal}
          />
          <SegmentedControl<CounterexampleSignal>
            label="Verifier response"
            value={counterexampleSignal}
            options={[
              { value: "none", label: "판정만" },
              { value: "concrete", label: "Concrete 반례 보존" },
            ]}
            onChange={chooseCounterexampleSignal}
          />
        </>
      }
      stageLabel="Two independent tracks · not a progression"
      legend={[
        { label: "현재 설명 lens", tone: "accent" },
        { label: "구현에서 확인한 signal", tone: "attention" },
        { label: "서로 독립인 질문", tone: "neutral" },
      ]}
      status={[
        { label: "Decision track", value: decisionLens },
        { label: "Synthesis track", value: synthesisLens },
        { label: "관계", value: "독립 track · 단계 아님" },
      ]}
      explanation={
        <>
          <strong>{decisionLens}</strong>은 다음 action을 고르는 환경
          의사결정 lens이고,{" "}
          <strong>
            {synthesisLens === "판별 보류"
              ? "typed evidence가 더 필요함"
              : synthesisLens}
          </strong>
          은 다음 candidate를 좁히는 합성 lens입니다. 두 선택은 발전 단계가
          아니라 서로 다른 질문에 대한 설명입니다.
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="MDP, POMDP, OGIS, CEGIS를 두 독립 track에서 선택하는 framework compass, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className="viz-svg viz-wide"
          viewBox="0 0 900 470"
          role="group"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <title id={titleId}>
            환경 의사결정과 후보 합성을 분리한 framework compass
          </title>
          <desc id={descriptionId}>
            충분히 관측된 state와 숨은 state 중 하나를 선택해 MDP 또는
            POMDP를 강조하고, typed oracle query와 다음 제약으로 보존되는 concrete counterexample
            여부에 따라 OGIS 또는 CEGIS를 강조합니다. 두 행은 독립적인
            질문이며 발전 순서를 나타내지 않습니다.
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
            <marker
              id={accentArrowId}
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

          <rect className="viz-lane" x="24" y="20" width="852" height="198" rx="8" />
          <text className="viz-eyebrow" x="44" y="48">
            DECISION TRACK · WHAT SHOULD THE AGENT DO NEXT?
          </text>
          <text className="viz-body" x="44" y="68">
            state와 observation 구조가 action-selection model을 결정합니다.
          </text>

          <rect
            className="viz-node viz-node-attention"
            x="46"
            y="92"
            width="230"
            height="92"
            rx="6"
          />
          <text className="viz-eyebrow" x="66" y="118">
            IMPLEMENTATION SIGNAL
          </text>
          <text className="viz-title" x="66" y="147">
            {stateSignal === "full"
              ? "의사결정 state를 충분히 관측"
              : "실제 원인은 직접 보이지 않음"}
          </text>
          <text className="viz-body" x="66" y="170">
            {stateSignal === "full"
              ? "현재 state가 과거를 충분히 요약"
              : "log와 test 결과로 hidden cause 추정"}
          </text>

          <path
            className={
              decisionLens === "MDP"
                ? "viz-flow viz-flow-accent"
                : "viz-flow"
            }
            d="M276 126 H374"
            markerEnd={
              decisionLens === "MDP"
                ? `url(#${accentArrowId})`
                : `url(#${arrowId})`
            }
          />
          <path
            className={
              decisionLens === "POMDP"
                ? "viz-flow viz-flow-accent"
                : "viz-flow"
            }
            d="M276 153 C356 206 552 206 622 153"
            markerEnd={
              decisionLens === "POMDP"
                ? `url(#${accentArrowId})`
                : `url(#${arrowId})`
            }
          />

          <g
            className="viz-interactive"
            role="button"
            tabIndex={0}
            aria-label="MDP lens, 충분히 관측된 state에서 다음 action의 장기 가치를 비교"
            aria-pressed={decisionLens === "MDP"}
            onClick={() => setStateSignal("full")}
            onKeyDown={(event) =>
              activateOnKey(event, () => setStateSignal("full"))
            }
          >
            {decisionLens === "MDP" ? (
              <rect
                className="viz-selection-halo"
                x="370"
                y="84"
                width="224"
                height="108"
                rx="9"
                fill="none"
                stroke="var(--fg-accent)"
                strokeWidth="2"
              />
            ) : null}
            <rect
              className={`viz-node ${
                decisionLens === "MDP" ? "viz-node-accent" : ""
              }`}
              x="374"
              y="88"
              width="216"
              height="100"
              rx="6"
            />
            <text className="viz-eyebrow" x="394" y="115">
              MDP · NEXT ACTION
            </text>
            <text className="viz-title" x="394" y="145">
              State → action value
            </text>
            <text className="viz-body" x="394" y="169">
              transition과 장기 return 비교
            </text>
          </g>

          <g
            className="viz-interactive"
            role="button"
            tabIndex={0}
            aria-label="POMDP lens, 숨은 state를 observation으로 추정하며 다음 action을 선택"
            aria-pressed={decisionLens === "POMDP"}
            onClick={() => setStateSignal("hidden")}
            onKeyDown={(event) =>
              activateOnKey(event, () => setStateSignal("hidden"))
            }
          >
            {decisionLens === "POMDP" ? (
              <rect
                className="viz-selection-halo"
                x="618"
                y="84"
                width="234"
                height="108"
                rx="9"
                fill="none"
                stroke="var(--fg-accent)"
                strokeWidth="2"
              />
            ) : null}
            <rect
              className={`viz-node ${
                decisionLens === "POMDP" ? "viz-node-accent" : ""
              }`}
              x="622"
              y="88"
              width="226"
              height="100"
              rx="6"
            />
            <text className="viz-eyebrow" x="642" y="115">
              POMDP · HIDDEN STATE
            </text>
            <text className="viz-title" x="642" y="145">
              Belief → action
            </text>
            <text className="viz-body" x="642" y="169">
              observation으로 원인 확률 갱신
            </text>
          </g>

          <rect className="viz-lane" x="24" y="238" width="852" height="198" rx="8" />
          <text className="viz-eyebrow" x="44" y="266">
            SYNTHESIS TRACK · WHAT CANDIDATE SHOULD COME NEXT?
          </text>
          <text className="viz-body" x="44" y="286">
            query와 verifier response가 candidate-refinement model을 결정합니다.
          </text>

          <rect
            className="viz-node viz-node-attention"
            x="46"
            y="310"
            width="230"
            height="92"
            rx="6"
          />
          <text className="viz-eyebrow" x="66" y="336">
            IMPLEMENTATION SIGNAL
          </text>
          <text className="viz-title" x="66" y="365">
            {querySignal === "typed" ? "Typed oracle query" : "형식 없는 feedback"}
          </text>
          <text className="viz-body" x="66" y="388">
            {counterexampleSignal === "concrete"
              ? "concrete input을 다음 제약으로 보존"
              : querySignal === "typed"
                ? "response schema에 맞춰 evidence 갱신"
                : "candidate 제거 근거가 식별되지 않음"}
          </text>

          <path
            className={
              synthesisLens === "OGIS"
                ? "viz-flow viz-flow-accent"
                : "viz-flow"
            }
            d="M276 344 H374"
            markerEnd={
              synthesisLens === "OGIS"
                ? `url(#${accentArrowId})`
                : `url(#${arrowId})`
            }
          />
          <path
            className={
              synthesisLens === "CEGIS"
                ? "viz-flow viz-flow-accent"
                : "viz-flow"
            }
            d="M276 371 C356 424 552 424 622 371"
            markerEnd={
              synthesisLens === "CEGIS"
                ? `url(#${accentArrowId})`
                : `url(#${arrowId})`
            }
          />

          <g
            className="viz-interactive"
            role="button"
            tabIndex={0}
            aria-label="OGIS lens, typed oracle response로 candidate version space를 줄임"
            aria-pressed={synthesisLens === "OGIS"}
            onClick={chooseOgis}
            onKeyDown={(event) => activateOnKey(event, chooseOgis)}
          >
            {synthesisLens === "OGIS" ? (
              <rect
                className="viz-selection-halo"
                x="370"
                y="302"
                width="224"
                height="108"
                rx="9"
                fill="none"
                stroke="var(--fg-accent)"
                strokeWidth="2"
              />
            ) : null}
            <rect
              className={`viz-node ${
                synthesisLens === "OGIS" ? "viz-node-accent" : ""
              }`}
              x="374"
              y="306"
              width="216"
              height="100"
              rx="6"
            />
            <text className="viz-eyebrow" x="394" y="333">
              OGIS · TYPED ORACLE
            </text>
            <text className="viz-title" x="394" y="363">
              Response → evidence
            </text>
            <text className="viz-body" x="394" y="387">
              version space와 모순되는 후보 제거
            </text>
          </g>

          <g
            className="viz-interactive"
            role="button"
            tabIndex={0}
            aria-label="CEGIS lens, concrete counterexample을 다음 candidate의 제약으로 보존"
            aria-pressed={synthesisLens === "CEGIS"}
            onClick={chooseCegis}
            onKeyDown={(event) => activateOnKey(event, chooseCegis)}
          >
            {synthesisLens === "CEGIS" ? (
              <rect
                className="viz-selection-halo"
                x="618"
                y="302"
                width="234"
                height="108"
                rx="9"
                fill="none"
                stroke="var(--fg-accent)"
                strokeWidth="2"
              />
            ) : null}
            <rect
              className={`viz-node ${
                synthesisLens === "CEGIS" ? "viz-node-accent" : ""
              }`}
              x="622"
              y="306"
              width="226"
              height="100"
              rx="6"
            />
            <text className="viz-eyebrow" x="642" y="333">
              CEGIS · COUNTEREXAMPLE
            </text>
            <text className="viz-title" x="642" y="363">
              Failure → constraint
            </text>
            <text className="viz-body" x="642" y="387">
              같은 concrete failure의 재등장 차단
            </text>
          </g>

          <text className="viz-body" x="450" y="459" textAnchor="middle">
            카드 사이에는 진행 화살표가 없습니다. 두 행은 서로 독립인 질문
            축입니다.
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
