"use client";

import { useRef, useState } from "react";

import {
  LabShell,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  CANONICAL_AUTORESEARCH_CAMPAIGN,
  LOOP_PHASES,
  OFFICIAL_EXAMPLE_FACTS,
  verdictLabel,
} from "./loop-model";
import { ProvenanceBadge } from "./presentation-shell";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./loop-scenes.module.css";

/** Wireframe §8.2 — 공식 사례만 담는 서사 컬럼 strip. */
export function OfficialExampleStrip() {
  return (
    <div className={styles.officialStrip} data-official-example-strip>
      <div className={styles.officialStripHeading}>
        <ProvenanceBadge kind="official-autoresearch-example" />
      </div>
      <dl>
        {OFFICIAL_EXAMPLE_FACTS.map((fact) => (
          <div key={fact.id} data-fact={fact.id}>
            <dt>{fact.label}</dt>
            <dd>
              {fact.value}
              {fact.caveat ? <small>{fact.caveat}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STEPS: PlaybackStep[] = [
  { id: "official", durationMs: 16000, label: "공식 사례의 fixed·mutable·metric·ledger" },
  { id: "morph", durationMs: 8000, label: "범용 contract 필드로 morph" },
  { id: "propose", durationMs: 6000, label: "hypothesis + bounded diff 제안" },
  { id: "execute", durationMs: 6000, label: "frozen harness에서 challenger 실행" },
  { id: "evidence", durationMs: 7000, label: "observation → metric + guards" },
  { id: "verdict", durationMs: 7000, label: "verdict: KEEP" },
  { id: "ledger", durationMs: 6000, label: "ledger append → memory 갱신" },
  { id: "boundary", durationMs: 4000, label: "policy · ledger · memory 경계" },
  { id: "handoff", durationMs: 4000, label: "experiment history로 전환" },
] as const;

type Lens = "contract" | "roles" | "state" | "memory";

type StateObjectId = "contract" | "incumbent" | "challenger" | "ledger";

const STATE_OBJECTS: Record<
  StateObjectId,
  {
    label: string;
    owner: string;
    lifetime: string;
    mutable: string;
    rollback: string;
  }
> = {
  contract: {
    label: "Research contract",
    owner: "Human owner + controller",
    lifetime: "campaign 전체 · 변경 시 새 version",
    mutable: "고정 (변경은 새 version)",
    rollback: "해당 없음",
  },
  incumbent: {
    label: "Incumbent",
    owner: "Controller",
    lifetime: "iteration 사이에 지속",
    mutable: "gate 전에는 덮어쓰지 않음",
    rollback: "KEEP 이전 상태로 복원 가능",
  },
  challenger: {
    label: "Challenger",
    owner: "Executor",
    lifetime: "한 experiment 동안",
    mutable: "격리 상태에서만 변경",
    rollback: "discard·crash 시 폐기와 rollback",
  },
  ledger: {
    label: "Experiment ledger",
    owner: "Controller",
    lifetime: "campaign 전체 · append-only",
    mutable: "추가만 가능, 삭제 없음",
    rollback: "실패도 지우지 않음",
  },
};

type IterationPhase = "propose" | "execute" | "evidence" | "verdict" | "ledger";

const ITERATION_RECORD = CANONICAL_AUTORESEARCH_CAMPAIGN[1];

/**
 * Scene 6 primary visual (wireframe §8). One iteration of the experiment
 * transaction replayed over the loop map; lenses re-highlight the same
 * diagram by contract, roles, state objects, or memory flow.
 */
export function AutoresearchLoopMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction, reachedStep } =
    useScenePlayback(STEPS, containerRef);
  const idPrefix = useSvgIdPrefix("loop-map");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [lens, setLens] = useState<Lens>("contract");
  const [selectedObject, setSelectedObject] =
    useState<StateObjectId>("incumbent");

  const stage =
    state.status === "idle"
      ? "official"
      : state.status === "completed"
        ? "handoff"
        : STEPS[state.step]?.id ?? "official";
  const generalized = stage !== "official";
  const verdictReached = reachedStep("verdict");

  const phaseActive = (phase: IterationPhase) => reachedStep(phase);

  const selectObject = (id: StateObjectId) => {
    markUserInteraction();
    setSelectedObject(id);
  };

  const objectHotspot = (
    id: StateObjectId,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => (
    <rect
      className={styles.objectHotspot}
      role="button"
      tabIndex={0}
      aria-pressed={selectedObject === id}
      aria-label={`${STATE_OBJECTS[id].label} 속성 보기`}
      x={x}
      y={y}
      width={Math.max(width, 44)}
      height={Math.max(height, 44)}
      rx="12"
      fill="transparent"
      onClick={() => selectObject(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectObject(id);
        }
      }}
    />
  );

  const metric = ITERATION_RECORD.metrics[0];

  return (
    <div
      ref={containerRef}
      data-loop-map
      data-stage={stage}
      data-lens={lens}
      data-generalized={generalized ? "true" : "false"}
    >
      <LabShell
        title="Autoresearch형 loop의 구조"
        subtitle="한 iteration = incumbent → 가설 → challenger → 실행 → 증거 → 판정 → 기록"
        legend={[
          { label: "공식 사례", tone: "attention" },
          { label: "엔지니어링 일반화", tone: "accent" },
          { label: "KEEP", tone: "success" },
        ]}
        stageLabel={`lens: ${lens} · iteration 1 재생`}
        controls={
          <>
            <PlaybackBar
              state={state}
              controls={controls}
              stepCount={STEPS.length}
              stepLabel={STEPS[Math.min(state.step, STEPS.length - 1)].label}
              markUserInteraction={markUserInteraction}
            />
            <SegmentedControl
              label="lens"
              value={lens}
              options={[
                { value: "contract", label: "contract" },
                { value: "roles", label: "roles" },
                { value: "state", label: "state" },
                { value: "memory", label: "memory" },
              ]}
              onChange={(value) => {
                markUserInteraction();
                setLens(value);
              }}
            />
          </>
        }
        status={[
          {
            label: "verdict",
            value: verdictReached
              ? verdictLabel(ITERATION_RECORD.verdict)
              : "PENDING · 판정 대기",
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>loop의 일곱 phase를 순서대로 제공합니다.</p>
            <ol className={styles.phaseList}>
              {LOOP_PHASES.map((phase) => (
                <li key={phase.id} data-phase={phase.id}>
                  <strong>{phase.title}</strong> — owner: {phase.owner} ·
                  변경: {phase.changed} · 지속: {phase.persisted}
                </li>
              ))}
            </ol>
            <div className={styles.objectDetail}>
              <h4>{STATE_OBJECTS[selectedObject].label}</h4>
              <dl data-object-detail>
                <div>
                  <dt>owner</dt>
                  <dd>{STATE_OBJECTS[selectedObject].owner}</dd>
                </div>
                <div>
                  <dt>lifetime</dt>
                  <dd>{STATE_OBJECTS[selectedObject].lifetime}</dd>
                </div>
                <div>
                  <dt>mutable</dt>
                  <dd>{STATE_OBJECTS[selectedObject].mutable}</dd>
                </div>
                <div>
                  <dt>rollback</dt>
                  <dd>{STATE_OBJECTS[selectedObject].rollback}</dd>
                </div>
              </dl>
            </div>
            <pre className={styles.pseudocode} aria-label="loop 의사코드">
              {`challenger = propose(incumbent, derived_memory, research_contract)
raw_observation = execute_in_frozen_harness(challenger, research_contract, random_seed)
verdict = evaluate_and_gate(raw_observation, incumbent_evaluation, research_contract)
next_incumbent = challenger if verdict == KEEP else incumbent
next_experiment_ledger = append(experiment_ledger, {hypothesis, diff, raw_observation, metric, verdict, reason})
next_derived_memory = compress(next_experiment_ledger)`}
            </pre>
            <p>
              이 의사코드는 model weight의 갱신이 아니라 외부 artifact와
              experiment state의 갱신을 나타냅니다.
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="Autoresearch loop 구조 다이어그램 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 540"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>Research contract 아래의 experiment loop 지도</title>
            <desc id={descId}>
              상단의 research contract 띠 아래에서 incumbent와 derived
              memory로부터 가설이 제안되고, 격리된 challenger가 frozen
              harness에서 실행되어 metric과 guard의 evidence가 되며, verdict가
              KEEP이면 challenger가 다음 incumbent가 되고 모든 결과는
              append-only ledger에 기록된다.
            </desc>

            {/* Contract band */}
            <g className={styles.contractBand} data-lens-target="contract">
              <rect x="24" y="24" width="632" height="64" rx="12" />
              <text className={styles.contractTitle} x="40" y="50">
                {generalized ? "Research contract" : "공식 사례"}
              </text>
              <text className={styles.contractFields} x="40" y="74">
                {generalized
                  ? "goal · mutable scope · frozen harness · metric/guards · trial budget"
                  : "val_bpb 낮추기 · train.py만 수정 · prepare.py 고정 · 5분 wall clock · results.tsv"}
              </text>
              {objectHotspot("contract", 24, 24, 632, 64)}
            </g>

            {/* Incumbent + memory */}
            <g
              className={styles.loopNode}
              data-node="incumbent"
              data-lens-target="state"
              data-active="true"
            >
              <rect x="40" y="128" width="180" height="64" rx="10" />
              <text className={styles.nodeTitle} x="54" y="154">
                Incumbent
              </text>
              <text className={styles.nodeDetail} x="54" y="174">
                {ITERATION_RECORD.incumbentBefore ?? "baseline"}
              </text>
              {objectHotspot("incumbent", 40, 128, 180, 64)}
            </g>
            <g
              className={styles.loopNode}
              data-node="memory"
              data-lens-target="memory"
              data-active={phaseActive("ledger") ? "true" : "false"}
            >
              <rect x="40" y="440" width="180" height="64" rx="10" />
              <text className={styles.nodeTitle} x="54" y="466">
                Derived memory
              </text>
              <text className={styles.nodeDetail} x="54" y="486">
                ledger를 압축한 다음 제안의 입력
              </text>
            </g>
            <g
              className={styles.loopNode}
              data-node="ledger"
              data-lens-target="memory"
              data-active={phaseActive("ledger") ? "true" : "false"}
            >
              <rect x="40" y="344" width="180" height="64" rx="10" />
              <text className={styles.nodeTitle} x="54" y="370">
                Experiment ledger
              </text>
              <text className={styles.nodeDetail} x="54" y="390">
                append-only · 실패도 기록
              </text>
              {objectHotspot("ledger", 40, 344, 180, 64)}
            </g>

            {/* Flow chain */}
            <g
              className={styles.loopNode}
              data-node="propose"
              data-lens-target="roles"
              data-active={phaseActive("propose") ? "true" : "false"}
            >
              <rect x="280" y="128" width="180" height="64" rx="10" />
              <text className={styles.nodeTitle} x="294" y="150">
                Proposer
              </text>
              <text className={styles.nodeDetail} x="294" y="168">
                {ITERATION_RECORD.hypothesis.statement}
              </text>
              <text className={styles.nodeDetail} x="294" y="184">
                changed scope: {ITERATION_RECORD.changedScope.join(", ")}
              </text>
            </g>
            <g
              className={styles.loopNode}
              data-node="challenger"
              data-lens-target="state"
              data-active={phaseActive("execute") ? "true" : "false"}
            >
              <rect x="280" y="220" width="180" height="60" rx="10" />
              <text className={styles.nodeTitle} x="294" y="244">
                Isolated challenger
              </text>
              <text className={styles.nodeDetail} x="294" y="264">
                {ITERATION_RECORD.challenger} · frozen harness 실행
              </text>
              {objectHotspot("challenger", 280, 220, 180, 60)}
            </g>
            <g
              className={styles.loopNode}
              data-node="evidence"
              data-lens-target="roles"
              data-active={phaseActive("evidence") ? "true" : "false"}
            >
              <rect x="280" y="308" width="180" height="60" rx="10" />
              <text className={styles.nodeTitle} x="294" y="332">
                Evaluator
              </text>
              <text className={styles.nodeDetail} x="294" y="352">
                {metric.name} {metric.value?.toFixed(4)} · guards pass
              </text>
            </g>
            <g
              className={styles.verdictNode}
              data-active={phaseActive("verdict") ? "true" : "false"}
            >
              <rect x="280" y="396" width="180" height="56" rx="10" />
              <text className={styles.nodeTitle} x="294" y="420">
                Controller verdict
              </text>
              <text
                className={styles.verdictValue}
                x="294"
                y="440"
                data-verdict={verdictReached ? "KEEP" : "PENDING"}
              >
                {verdictReached ? "KEEP" : "PENDING"}
              </text>
            </g>

            {/* Keep / discard branch */}
            <g
              className={styles.branchNode}
              data-branch="keep"
              data-active={phaseActive("verdict") ? "true" : "false"}
            >
              <rect x="512" y="360" width="148" height="56" rx="10" />
              <text className={styles.nodeTitle} x="524" y="384">
                KEEP
              </text>
              <text className={styles.nodeDetail} x="524" y="402">
                challenger가 다음 incumbent
              </text>
            </g>
            <g className={styles.branchNode} data-branch="discard" data-active="false">
              <rect x="512" y="440" width="148" height="56" rx="10" />
              <text className={styles.nodeTitle} x="524" y="464">
                DISCARD / CRASH
              </text>
              <text className={styles.nodeDetail} x="524" y="482">
                incumbent 유지
              </text>
            </g>

            {/* Arrows */}
            <g className={styles.loopArrows}>
              <path d="M220 160 H274" data-active={phaseActive("propose") ? "true" : "false"} />
              <path d="M370 192 V214" data-active={phaseActive("execute") ? "true" : "false"} />
              <path d="M370 280 V302" data-active={phaseActive("evidence") ? "true" : "false"} />
              <path d="M370 368 V390" data-active={phaseActive("verdict") ? "true" : "false"} />
              <path d="M460 424 L506 396" data-active={phaseActive("verdict") ? "true" : "false"} />
              <path d="M460 436 L506 462" data-active="false" />
              <path d="M280 430 L226 392" data-active={phaseActive("ledger") ? "true" : "false"} />
              <path d="M130 408 V434" data-active={phaseActive("ledger") ? "true" : "false"} />
              <path d="M130 440 C 110 300, 110 240, 130 198" data-active={phaseActive("ledger") ? "true" : "false"} data-return="true" />
            </g>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
