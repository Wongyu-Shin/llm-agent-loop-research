"use client";

import { useMemo, useRef, useState } from "react";

import {
  LabShell,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  CANONICAL_AUTORESEARCH_CAMPAIGN,
  CRITERION_TRANSITION_EXAMPLE,
  DIAGNOSTIC_CASES,
  determineStopReason,
  foldCampaign,
  formatMemoryValue,
  formatMetricValue,
  GATE_ORDER,
  PLATEAU_LIMIT,
  TELEMETRY_SAMPLE,
  type CriterionMode,
  type StopInputs,
} from "./loop-model";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./loop-scenes.module.css";

const STEPS: PlaybackStep[] = [
  { id: "baseline", durationMs: 6000, label: "baseline과 contract 고정" },
  { id: "keep", durationMs: 10000, label: "KEEP · incumbent 전진" },
  { id: "discard", durationMs: 10000, label: "DISCARD · incumbent 유지" },
  { id: "crash", durationMs: 10000, label: "CRASH · 측정 없음" },
  { id: "compare", durationMs: 12000, label: "candidate vs system-after-gate" },
  { id: "diagnose", durationMs: 8000, label: "증상에서 고장 층으로" },
  { id: "stop", durationMs: 10000, label: "plateau와 safety stop 비교" },
  { id: "hold", durationMs: 4000, label: "best-so-far와 stop reason" },
] as const;

type Mode = "replay" | "diagnose" | "stop";

const MODE_FOR_STEP: Record<string, Mode> = {
  baseline: "replay",
  keep: "replay",
  discard: "replay",
  crash: "replay",
  compare: "diagnose",
  diagnose: "diagnose",
  stop: "stop",
  hold: "stop",
};

const REVEAL_FOR_STEP: Record<string, number> = {
  baseline: 1,
  keep: 2,
  discard: 3,
  crash: 4,
};

const DEFAULT_STOP_INPUTS: StopInputs = {
  manualInterrupt: false,
  safetyViolation: false,
  harnessValid: true,
  successPredicateMet: false,
  humanGateRequired: false,
  cycleDetected: false,
  plateauIterations: 0,
  campaignBudgetRemainingHours: 4,
  testableHypothesisAvailable: true,
};

const STOP_TOGGLES: Array<{
  key: keyof Pick<
    StopInputs,
    | "manualInterrupt"
    | "safetyViolation"
    | "harnessValid"
    | "successPredicateMet"
    | "humanGateRequired"
    | "cycleDetected"
    | "testableHypothesisAvailable"
  >;
  label: string;
}> = [
  { key: "manualInterrupt", label: "manual interrupt" },
  { key: "safetyViolation", label: "safety violation" },
  { key: "harnessValid", label: "harness valid" },
  { key: "successPredicateMet", label: "success predicate" },
  { key: "humanGateRequired", label: "human gate" },
  { key: "cycleDetected", label: "cycle detected" },
  { key: "testableHypothesisAvailable", label: "hypothesis 남음" },
];

const LANE_X = [86, 236, 386, 536];

/**
 * Scene 7 primary visual (wireframe §9). Replay folds the canonical
 * 4-record fixture through the shared reducer; diagnose compares candidate
 * transitions with the system state after the gate; stop turns the
 * continue-condition into structured stop reasons.
 */
export function LoopControlWorkbench() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("control-workbench");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [userMode, setUserMode] = useState<Mode | null>(null);
  const [criterionMode, setCriterionMode] = useState<CriterionMode>("binary");
  const [stopInputs, setStopInputs] = useState<StopInputs>(DEFAULT_STOP_INPUTS);

  const stepId =
    state.status === "idle"
      ? "baseline"
      : STEPS[Math.min(state.step, STEPS.length - 1)].id;
  const mode = userMode ?? MODE_FOR_STEP[stepId];
  const revealed =
    userMode !== null || state.status === "completed"
      ? 4
      : (REVEAL_FOR_STEP[stepId] ?? 4);

  const visibleRecords = CANONICAL_AUTORESEARCH_CAMPAIGN.slice(0, revealed);
  const campaign = useMemo(
    () => foldCampaign(CANONICAL_AUTORESEARCH_CAMPAIGN.slice(0, revealed)),
    [revealed],
  );
  const stopReason = determineStopReason(stopInputs);

  const selectMode = (value: Mode) => {
    markUserInteraction();
    setUserMode(value);
  };

  const toggleStopInput = (key: (typeof STOP_TOGGLES)[number]["key"]) => {
    markUserInteraction();
    setStopInputs((current) => ({ ...current, [key]: !current[key] }));
  };

  const example = CRITERION_TRANSITION_EXAMPLE;

  return (
    <div ref={containerRef} data-control-workbench data-mode={mode} data-stage={stepId}>
      <LabShell
        title="Loop control workbench"
        subtitle="같은 ledger로 replay · diagnose · stop을 전환한다"
        legend={[
          { label: "KEEP", tone: "success" },
          { label: "DISCARD·CRASH", tone: "danger" },
          { label: "ENGINEERING TRANSFER", tone: "attention" },
        ]}
        stageLabel={`incumbent ${campaign.incumbent ?? "없음"} · ledger ${campaign.ledger.length}건`}
        actions={
          <div role="tablist" aria-label="workbench mode" className={styles.modeTabs}>
            {(["replay", "diagnose", "stop"] as Mode[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                role="tab"
                aria-selected={mode === candidate}
                onClick={() => selectMode(candidate)}
              >
                {candidate}
              </button>
            ))}
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
            {mode === "diagnose" ? (
              <SegmentedControl
                label="criterion"
                value={criterionMode}
                options={[
                  { value: "binary", label: "사례별 pass/fail" },
                  { value: "scalar", label: "연속형 scalar" },
                ]}
                onChange={(value) => {
                  markUserInteraction();
                  setCriterionMode(value);
                }}
              />
            ) : null}
            {mode === "stop" ? (
              <div className={styles.stopControls}>
                <div className={styles.stopToggleRow} role="group" aria-label="stop 조건">
                  {STOP_TOGGLES.map((toggle) => (
                    <button
                      key={toggle.key}
                      type="button"
                      aria-pressed={Boolean(stopInputs[toggle.key])}
                      onClick={() => toggleStopInput(toggle.key)}
                    >
                      {toggle.label}
                    </button>
                  ))}
                </div>
                <label className={styles.stopSlider}>
                  plateau {stopInputs.plateauIterations} / {PLATEAU_LIMIT}
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={stopInputs.plateauIterations}
                    aria-valuetext={`plateau ${stopInputs.plateauIterations} iterations`}
                    onChange={(event) => {
                      markUserInteraction();
                      setStopInputs((current) => ({
                        ...current,
                        plateauIterations: Number(event.target.value),
                      }));
                    }}
                  />
                </label>
                <label className={styles.stopSlider}>
                  budget {stopInputs.campaignBudgetRemainingHours}h
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={1}
                    value={stopInputs.campaignBudgetRemainingHours}
                    aria-valuetext={`campaign budget ${stopInputs.campaignBudgetRemainingHours} hours`}
                    onChange={(event) => {
                      markUserInteraction();
                      setStopInputs((current) => ({
                        ...current,
                        campaignBudgetRemainingHours: Number(event.target.value),
                      }));
                    }}
                  />
                </label>
              </div>
            ) : null}
          </>
        }
        status={[
          { label: "incumbent", value: campaign.incumbent ?? "없음" },
          {
            label: "best-so-far",
            value: campaign.bestSoFar
              ? `${campaign.bestSoFar.revision} · ${campaign.bestSoFar.metricValue.toFixed(4)}`
              : "없음",
          },
          { label: "stop reason", value: stopReason ?? "계속 실행" },
        ]}
        explanation={
          <div data-visual-fallback>
            <table className={styles.transferTable} data-ledger-table>
              <caption>canonical replay ledger · crash sentinel은 측정 없음으로 표시</caption>
              <thead>
                <tr>
                  <th scope="col">iteration</th>
                  <th scope="col">challenger</th>
                  <th scope="col">val_bpb ↓</th>
                  <th scope="col">peak memory</th>
                  <th scope="col">verdict</th>
                  <th scope="col">incumbent after</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.iteration} data-verdict={record.verdict}>
                    <td>{record.iteration}</td>
                    <td>{record.challenger}</td>
                    <td>{formatMetricValue(record.metrics[0]?.value ?? null)}</td>
                    <td>
                      {formatMemoryValue(record.metrics[1]?.value ?? null)}
                    </td>
                    <td>{record.verdict}</td>
                    <td>{record.incumbentAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className={styles.rawDrawer} data-raw-drawer>
              <summary>raw results.tsv drawer (원형 sentinel 보존)</summary>
              <pre>
                {visibleRecords.map((record) => record.rawLedgerRow).join("\n")}
              </pre>
            </details>
            <p data-gate-order>
              gate 순서:{" "}
              {GATE_ORDER.map(
                (step) =>
                  `${step.label}${step.provenance === "engineering-transfer" ? " [ENGINEERING TRANSFER]" : ""}`,
              ).join(" → ")}
            </p>
            {criterionMode === "binary" ? (
              <table className={styles.transferTable} data-transition-compare>
                <caption>
                  candidate 전이 (criterion {example.totalCriteria}개) vs
                  system-after-gate
                </caption>
                <tbody>
                  <tr>
                    <th scope="row">incumbent 통과</th>
                    <td>{example.incumbentPass}</td>
                  </tr>
                  <tr>
                    <th scope="row">candidate 보존 / 훼손</th>
                    <td>
                      {example.preserved} / {example.damaged} (candidate CLₜ{" "}
                      {(example.candidateConfidenceLevel * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">candidate 복구 / 잔여</th>
                    <td>
                      {example.recovered} / {example.remaining} (candidate CSₜ{" "}
                      {(example.candidateCritiqueScore * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">verdict</th>
                    <td>{example.verdict}</td>
                  </tr>
                  <tr>
                    <th scope="row">system-after-gate 통과</th>
                    <td>{example.systemPassAfterGate} · incumbent 보호됨</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p data-scalar-disabled>
                연속형 scalar metric 하나는 사례별 전이표를 제공하지 않으므로
                CLₜ/CSₜ 표를 비활성화합니다. 대신 metric delta, 분산, guard,
                holdout을 직접 비교합니다.
              </p>
            )}
            <table className={styles.transferTable} data-diagnose-table>
              <caption>증상에서 고장 층으로</caption>
              <thead>
                <tr>
                  <th scope="col">증상</th>
                  <th scope="col">먼저 볼 층</th>
                  <th scope="col">확인할 evidence</th>
                </tr>
              </thead>
              <tbody>
                {DIAGNOSTIC_CASES.map((diagnostic) => (
                  <tr key={diagnostic.id}>
                    <td>{diagnostic.symptom}</td>
                    <td>{diagnostic.boundary}</td>
                    <td>{diagnostic.evidence.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p data-stop-summary>
              현재 stop reason: {stopReason ?? "없음 (계속 실행)"} · 종료 시
              마지막 candidate가 아니라 검증된 best-so-far{" "}
              {campaign.bestSoFar?.revision ?? "없음"}과 남은 불확실성, stop
              reason을 함께 반환합니다.
            </p>
            <pre className={styles.pseudocode} aria-label="최소 telemetry 예시">
              {JSON.stringify(TELEMETRY_SAMPLE, null, 2)}
            </pre>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="loop control workbench 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 460"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>replay, diagnose, stop 세 모드의 loop 통제</title>
            <desc id={descId}>
              replay 모드는 KEEP에서만 전진하는 incumbent 레인과 분기로 끝나는
              discard·crash 시도를, diagnose 모드는 candidate 전이와 gate 이후
              system 상태의 차이를, stop 모드는 continue 조건과 구조화된 stop
              reason을 보여 준다.
            </desc>

            {mode === "replay" ? (
              <g>
                <text className={styles.laneTitle} x="40" y="64">
                  incumbent lane · KEEP에서만 전진
                </text>
                <line className={styles.laneLine} x1="60" y1="110" x2="640" y2="110" />
                {visibleRecords.map((record, index) => (
                  <g key={record.iteration}>
                    {record.verdict === "KEEP" ? (
                      <g className={styles.laneNode} data-verdict="KEEP">
                        <circle cx={LANE_X[index]} cy="110" r="15" />
                        <text
                          className={styles.laneNodeLabel}
                          x={LANE_X[index]}
                          y="86"
                          textAnchor="middle"
                        >
                          {record.challenger}
                        </text>
                      </g>
                    ) : (
                      <g
                        className={styles.laneNode}
                        data-verdict={record.verdict}
                      >
                        <line
                          className={styles.branchLine}
                          x1={LANE_X[index - 1] ?? LANE_X[index]}
                          y1="110"
                          x2={LANE_X[index]}
                          y2="210"
                        />
                        <circle cx={LANE_X[index]} cy="210" r="14" />
                        <text
                          className={styles.laneNodeLabel}
                          x={LANE_X[index]}
                          y="246"
                          textAnchor="middle"
                        >
                          {record.challenger} · {record.verdict}
                        </text>
                        <text
                          className={styles.laneNodeSub}
                          x={LANE_X[index]}
                          y="264"
                          textAnchor="middle"
                        >
                          {record.verdict === "CRASH"
                            ? "측정 없음"
                            : formatMetricValue(record.metrics[0]?.value ?? null, 4)}
                        </text>
                      </g>
                    )}
                    {index > 0 && record.verdict === "KEEP" ? (
                      <line
                        className={styles.laneAdvance}
                        x1={LANE_X[index - 1] + 15}
                        y1="110"
                        x2={LANE_X[index] - 15}
                        y2="110"
                      />
                    ) : null}
                  </g>
                ))}
                <text className={styles.laneCaption} x="40" y="316">
                  incumbent: {campaign.incumbent ?? "없음"} · best-so-far:{" "}
                  {campaign.bestSoFar?.revision ?? "없음"}
                </text>
                {GATE_ORDER.map((gate, index) => (
                  <g
                    key={gate.id}
                    className={styles.gateChip}
                    data-provenance={gate.provenance}
                  >
                    <rect x={40 + index * 124} y="348" width="112" height="44" rx="9" />
                    <text x={96 + index * 124} y="374" textAnchor="middle">
                      {gate.label}
                    </text>
                    {gate.provenance === "engineering-transfer" ? (
                      <text
                        className={styles.gateChipTag}
                        x={96 + index * 124}
                        y="406"
                        textAnchor="middle"
                      >
                        TRANSFER
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            ) : null}

            {mode === "diagnose" ? (
              <g>
                <text className={styles.laneTitle} x="40" y="56">
                  candidate 전이 (criterion {example.totalCriteria}개)
                </text>
                {criterionMode === "binary" ? (
                  <g>
                    {[
                      { label: "보존", value: example.preserved, tone: "good", x: 40 },
                      { label: "훼손", value: example.damaged, tone: "danger", x: 196 },
                      { label: "복구", value: example.recovered, tone: "good", x: 352 },
                      { label: "잔여", value: example.remaining, tone: "muted", x: 508 },
                    ].map((cell) => (
                      <g key={cell.label} className={styles.compareCell} data-tone={cell.tone}>
                        <rect x={cell.x} y="76" width="132" height="86" rx="10" />
                        <text className={styles.compareLabel} x={cell.x + 14} y="104">
                          {cell.label}
                        </text>
                        <text className={styles.compareValue} x={cell.x + 14} y="140">
                          {cell.value}
                        </text>
                      </g>
                    ))}
                    <text className={styles.laneCaption} x="40" y="204">
                      candidate CLₜ {(example.candidateConfidenceLevel * 100).toFixed(1)}% ·
                      candidate CSₜ {(example.candidateCritiqueScore * 100).toFixed(1)}% →
                      verdict {example.verdict}
                    </text>
                    <g className={styles.systemPanel}>
                      <rect x="40" y="232" width="600" height="96" rx="12" />
                      <text className={styles.compareLabel} x="60" y="266">
                        system-after-gate
                      </text>
                      <text className={styles.compareValue} x="60" y="304">
                        통과 {example.systemPassAfterGate} / {example.totalCriteria} · discard로
                        incumbent 보호
                      </text>
                    </g>
                    <text className={styles.laneCaption} x="40" y="372">
                      훼손이 큰 candidate를 정확히 discard하면 candidate 수준 CLₜ가
                      낮아도 system 수준 보존은 유지된다
                    </text>
                  </g>
                ) : (
                  <g>
                    <rect className={styles.disabledPanel} x="40" y="88" width="600" height="150" rx="12" />
                    <text className={styles.compareLabel} x="60" y="128">
                      연속형 scalar metric 하나 → CLₜ/CSₜ 전이표 비활성
                    </text>
                    <text className={styles.laneCaption} x="60" y="164">
                      사례별 전이 정보가 없으므로 metric delta, 분산,
                    </text>
                    <text className={styles.laneCaption} x="60" y="190">
                      guard regression, gold/holdout을 직접 비교한다
                    </text>
                  </g>
                )}
              </g>
            ) : null}

            {mode === "stop" ? (
              <g>
                <text className={styles.laneTitle} x="40" y="56">
                  continue only if — 모든 조건이 참일 때만 계속
                </text>
                {[
                  { label: "manual interrupt 없음", ok: !stopInputs.manualInterrupt },
                  { label: "safety block 없음", ok: !stopInputs.safetyViolation },
                  { label: "harness 유효", ok: stopInputs.harnessValid },
                  { label: "human gate 없음", ok: !stopInputs.humanGateRequired },
                  { label: "success 미충족", ok: !stopInputs.successPredicateMet },
                  { label: "cycle 없음", ok: !stopInputs.cycleDetected },
                  {
                    label: `plateau < ${PLATEAU_LIMIT} (현재 ${stopInputs.plateauIterations})`,
                    ok: stopInputs.plateauIterations < PLATEAU_LIMIT,
                  },
                  {
                    label: `budget 잔여 (${stopInputs.campaignBudgetRemainingHours}h)`,
                    ok: stopInputs.campaignBudgetRemainingHours > 0,
                  },
                  {
                    label: "testable hypothesis 남음",
                    ok: stopInputs.testableHypothesisAvailable,
                  },
                ].map((condition, index) => (
                  <g
                    key={condition.label}
                    className={styles.conditionRow}
                    data-ok={condition.ok ? "true" : "false"}
                  >
                    <rect
                      x={index % 2 === 0 ? 40 : 348}
                      y={76 + Math.floor(index / 2) * 58}
                      width="292"
                      height="46"
                      rx="9"
                    />
                    <text
                      x={(index % 2 === 0 ? 40 : 348) + 16}
                      y={105 + Math.floor(index / 2) * 58}
                    >
                      {condition.ok ? "✓" : "✕"} {condition.label}
                    </text>
                  </g>
                ))}
                <g
                  className={styles.stopVerdictPanel}
                  data-stopped={stopReason ? "true" : "false"}
                >
                  <rect x="40" y="376" width="600" height="60" rx="12" />
                  <text x="60" y="412">
                    {stopReason
                      ? `STOP · ${stopReason} → best-so-far ${campaign.bestSoFar?.revision ?? "없음"} 반환`
                      : "CONTINUE · 다음 experiment로 진행"}
                  </text>
                </g>
              </g>
            ) : null}
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
