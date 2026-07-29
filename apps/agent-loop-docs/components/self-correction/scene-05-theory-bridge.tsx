"use client";

import { useRef, useState } from "react";

import {
  LabShell,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import { THEORY_TRANSFER_ROWS, type CriterionMode } from "./loop-model";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./loop-scenes.module.css";

const STEPS: PlaybackStep[] = [
  { id: "boundary", durationMs: 4000, label: "적용 경계 읽기" },
  { id: "paper", durationMs: 4000, label: "논문 모형 읽기" },
  { id: "morph", durationMs: 8000, label: "엔지니어링 전이로 morph" },
  { id: "warning", durationMs: 4000, label: "적용 경고 고정" },
];

const PAPER_CHAIN = [
  { id: "artifact", title: "aᵢ,ₜ", detail: "같은 응답" },
  { id: "revise", title: "self-correct", detail: "같은 수정 절차" },
  { id: "judge", title: "pass / fail", detail: "외부 정답 판정" },
  { id: "rates", title: "CLₜ / CSₜ", detail: "집단의 조건부 전이율" },
] as const;

const LOOP_CHAIN = [
  { id: "incumbent", title: "Incumbent", detail: "iteration t의 채택 상태" },
  { id: "proposal", title: "bounded diff", detail: "testable hypothesis 제안" },
  { id: "challenger", title: "Challenger", detail: "격리 실행" },
  { id: "evidence", title: "frozen harness", detail: "evidence + verdict" },
  { id: "gate", title: "keep / discard", detail: "KEEP만 다음 incumbent" },
] as const;

const MORPH_LINKS = [
  { from: 0, to: 0 },
  { from: 1, to: 1 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
] as const;

const LEFT_X = 46;
const RIGHT_X = 452;
const BOX_WIDTH = 182;
const BOX_HEIGHT = 58;

function paperY(index: number) {
  return 74 + index * 82;
}

function loopY(index: number) {
  return 58 + index * 66;
}

/**
 * Scene 5 visual (wireframe §7). The paper's revision chain on the left
 * morphs into the engineering experiment loop on the right; the morph
 * links show which discipline transfers and under which condition.
 */
export function TheoryToLoopBridge() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("theory-bridge");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [criterionMode, setCriterionMode] = useState<CriterionMode>("binary");

  const stage =
    state.status === "idle"
      ? "boundary"
      : state.status === "completed"
        ? "warning"
        : STEPS[state.step]?.id ?? "boundary";
  const showLoop = stage === "morph" || stage === "warning";

  return (
    <div ref={containerRef} data-theory-bridge data-stage={stage}>
      <LabShell
        title="논문 모형에서 엔지니어링 전이로"
        subtitle="같은 답의 자기수정 회계를 experiment loop의 진단 렌즈로 옮긴다"
        legend={[
          { label: "논문 모형", tone: "accent" },
          { label: "엔지니어링 전이", tone: "attention" },
        ]}
        stageLabel={
          criterionMode === "binary"
            ? "사례별 pass/fail criterion 있음 · 전이 회계 사용 가능"
            : "연속형 scalar metric 하나 · CLₜ/CSₜ를 만들지 않음"
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
          </>
        }
        status={[
          {
            label: "전환 규칙",
            value:
              criterionMode === "binary"
                ? "candidate와 system-after-gate 전이를 별도 측정"
                : "metric delta · uncertainty · guards · holdout 직접 비교",
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              가져올 것, 번역할 것, 가져오지 않을 것의 일곱 행입니다. 전환
              조건이 깨지면 해당 행은 옮기지 않습니다.
            </p>
            <table className={styles.transferTable}>
              <caption>논문 → Autoresearch형 loop 전환 표</caption>
              <thead>
                <tr>
                  <th scope="col">논문</th>
                  <th scope="col">전환 조건</th>
                  <th scope="col">loop에서의 해석</th>
                </tr>
              </thead>
              <tbody>
                {THEORY_TRANSFER_ROWS.map((row) => (
                  <tr key={row.id} data-row={row.id}>
                    <td>{row.paper}</td>
                    <td>{row.transferCondition}</td>
                    <td>
                      {criterionMode === "scalar" && row.scalarAlternative
                        ? row.scalarAlternative
                        : row.engineering}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="논문 모형과 엔지니어링 전이 다이어그램 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 430"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>논문 모형이 experiment loop로 옮겨지는 다리</title>
            <desc id={descId}>
              왼쪽에는 같은 응답을 수정하고 외부 판정으로 CLₜ와 CSₜ를 계산하는
              논문 모형이, 오른쪽에는 incumbent에서 challenger를 만들어 frozen
              harness의 evidence로 keep과 discard를 판정하는 loop가 있으며, 두
              구조의 대응 관계가 연결선으로 표시된다.
            </desc>

            <text className={styles.columnHeading} data-side="paper" x={LEFT_X} y="36">
              PAPER MODEL
            </text>
            <text
              className={styles.columnHeading}
              data-side="loop"
              x={RIGHT_X}
              y="36"
            >
              ENGINEERING TRANSFER
            </text>

            {PAPER_CHAIN.map((node, index) => (
              <g key={node.id} className={styles.bridgeNode} data-side="paper">
                <rect
                  x={LEFT_X}
                  y={paperY(index)}
                  width={BOX_WIDTH}
                  height={BOX_HEIGHT}
                  rx="10"
                />
                <text className={styles.nodeTitle} x={LEFT_X + 14} y={paperY(index) + 25}>
                  {node.title}
                </text>
                <text className={styles.nodeDetail} x={LEFT_X + 14} y={paperY(index) + 44}>
                  {node.detail}
                </text>
                {index < PAPER_CHAIN.length - 1 ? (
                  <line
                    className={styles.chainLink}
                    x1={LEFT_X + BOX_WIDTH / 2}
                    y1={paperY(index) + BOX_HEIGHT}
                    x2={LEFT_X + BOX_WIDTH / 2}
                    y2={paperY(index + 1)}
                  />
                ) : null}
              </g>
            ))}

            <g data-loop-column data-visible={showLoop ? "true" : "false"} className={styles.loopColumn}>
              {LOOP_CHAIN.map((node, index) => (
                <g key={node.id} className={styles.bridgeNode} data-side="loop">
                  <rect
                    x={RIGHT_X}
                    y={loopY(index)}
                    width={BOX_WIDTH}
                    height={BOX_HEIGHT}
                    rx="10"
                  />
                  <text className={styles.nodeTitle} x={RIGHT_X + 14} y={loopY(index) + 25}>
                    {node.title}
                  </text>
                  <text className={styles.nodeDetail} x={RIGHT_X + 14} y={loopY(index) + 44}>
                    {node.detail}
                  </text>
                  {index < LOOP_CHAIN.length - 1 ? (
                    <line
                      className={styles.chainLink}
                      x1={RIGHT_X + BOX_WIDTH / 2}
                      y1={loopY(index) + BOX_HEIGHT}
                      x2={RIGHT_X + BOX_WIDTH / 2}
                      y2={loopY(index + 1)}
                    />
                  ) : null}
                </g>
              ))}
              {MORPH_LINKS.map((link, index) => (
                <path
                  key={`${link.from}-${link.to}`}
                  className={styles.morphLink}
                  style={{ transitionDelay: `${index * 0.7}s` }}
                  d={`M${LEFT_X + BOX_WIDTH} ${paperY(link.from) + BOX_HEIGHT / 2} C ${LEFT_X + BOX_WIDTH + 90} ${paperY(link.from) + BOX_HEIGHT / 2}, ${RIGHT_X - 90} ${loopY(link.to) + BOX_HEIGHT / 2}, ${RIGHT_X} ${loopY(link.to) + BOX_HEIGHT / 2}`}
                />
              ))}
            </g>

            <g
              className={styles.bridgeWarning}
              data-visible={stage === "warning" ? "true" : "false"}
            >
              <text x="340" y="412" textAnchor="middle">
                정답·오답 상태를 challenger·incumbent와 직접 동일시하지 않는다 —
                옮기는 것은 복구와 훼손을 따로 세는 질문이다
              </text>
            </g>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
