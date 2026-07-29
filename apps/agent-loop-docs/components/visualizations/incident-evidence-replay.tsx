"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import {
  LabShell,
  ResetButton,
  SegmentedControl,
} from "@/components/visualizations/viz-shell";

type IterationId = "00" | "01" | "02" | "03";
type Tone = "neutral" | "success" | "attention" | "danger";

type IncidentFrame = {
  id: IterationId;
  phase: string;
  patchLabel: string;
  patchLines: string[];
  action: string;
  checks: Array<{
    label: string;
    result: string;
    detail: string;
    tone: Tone;
  }>;
  evidence: string[];
  externalSource: string;
  changesNextPatch: boolean;
  explanation: string;
};

const FRAMES: IncidentFrame[] = [
  {
    id: "00",
    phase: "GOAL · REPRODUCE",
    patchLabel: "현재 구현",
    patchLines: ["total =", "subtotal - discount"],
    action: "실패 요청을 API에 실행",
    checks: [
      {
        label: "재현 요청",
        result: "−2000",
        detail: "음수 total 확인",
        tone: "danger",
      },
      {
        label: "Contract",
        result: "대기",
        detail: "아직 실행하지 않음",
        tone: "neutral",
      },
    ],
    evidence: [
      "goal · 음수 total 금지",
      "request · 10000 / 12000",
    ],
    externalSource: "API response",
    changesNextPatch: false,
    explanation: "실패 요청과 목표를 보존해 첫 patch가 해결해야 할 출발점을 만듭니다.",
  },
  {
    id: "01",
    phase: "PATCH · VERIFY",
    patchLabel: "Clamp patch",
    patchLines: ["Math.max(0,", "subtotal - discount)"],
    action: "unit + contract test 실행",
    checks: [
      {
        label: "Unit test",
        result: "PASS",
        detail: "total은 0 이상",
        tone: "success",
      },
      {
        label: "Contract",
        result: "FAIL",
        detail: "expected 400 · got 200",
        tone: "danger",
      },
    ],
    evidence: [
      "goal · 음수 total 금지",
      "request · 10000 / 12000",
      "counterexample · 400 ≠ 200",
    ],
    externalSource: "contract test",
    changesNextPatch: true,
    explanation: "Contract test라는 외부 evidence가 clamp 후보를 탈락시키고 다음 patch의 방향을 validator로 바꿉니다.",
  },
  {
    id: "02",
    phase: "INSPECT · UPDATE",
    patchLabel: "새 validation 가설",
    patchLines: ["discount > subtotal", "→ 400 Bad Request"],
    action: "OpenAPI와 실패 assertion 확인",
    checks: [
      {
        label: "OpenAPI",
        result: "FOUND",
        detail: "초과 할인은 400",
        tone: "attention",
      },
      {
        label: "반례",
        result: "RETAIN",
        detail: "{10000, 12000}",
        tone: "danger",
      },
    ],
    evidence: [
      "goal · 음수 total 금지",
      "request · 10000 / 12000",
      "counterexample · 400 ≠ 200",
      "contract · 초과 할인 거부",
    ],
    externalSource: "spec + failing input",
    changesNextPatch: true,
    explanation: "명세와 재현 가능한 반례를 함께 남기면 다음 후보가 반드시 만족해야 할 조건이 명시됩니다.",
  },
  {
    id: "03",
    phase: "PATCH · ACCEPT",
    patchLabel: "Validator patch",
    patchLines: ["if (discount > subtotal)", "return 400"],
    action: "전체 test suite 실행",
    checks: [
      {
        label: "Unit test",
        result: "PASS",
        detail: "계산 회귀 없음",
        tone: "success",
      },
      {
        label: "Contract",
        result: "PASS",
        detail: "초과 할인 400",
        tone: "success",
      },
    ],
    evidence: [
      "goal · 음수 total 금지",
      "request · 10000 / 12000",
      "counterexample · 400 ≠ 200",
      "contract · 초과 할인 거부",
      "regression · full suite PASS",
    ],
    externalSource: "full test suite",
    changesNextPatch: false,
    explanation: "최종 patch와 회귀 조건을 보존해 같은 계약 위반이 이후 변경에서 다시 나타나는지 검사할 수 있습니다.",
  },
];

function toneClass(tone: Tone) {
  if (tone === "success") return "viz-node-success";
  if (tone === "attention") return "viz-node-attention";
  if (tone === "danger") return "viz-node-danger";
  return "";
}

function activateOnKey(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

export function IncidentEvidenceReplay() {
  const [iteration, setIteration] = useState<IterationId>("00");
  const reactId = useId().replace(/:/g, "");
  const titleId = `incident-evidence-title-${reactId}`;
  const descriptionId = `incident-evidence-desc-${reactId}`;
  const arrowId = `incident-evidence-arrow-${reactId}`;
  const accentArrowId = `incident-evidence-accent-arrow-${reactId}`;
  const successArrowId = `incident-evidence-success-arrow-${reactId}`;

  const frameIndex = FRAMES.findIndex((frame) => frame.id === iteration);
  const frame = FRAMES[frameIndex];

  function move(delta: number) {
    const nextIndex = Math.max(
      0,
      Math.min(FRAMES.length - 1, frameIndex + delta),
    );
    setIteration(FRAMES[nextIndex].id);
  }

  return (
    <LabShell
      title="실행 evidence가 다음 patch를 바꾸는 incident replay"
      subtitle="결제 API 수정의 네 iteration을 따라가며 patch, 외부 검증, 보존된 evidence의 변화를 확인합니다."
      actions={
        <>
          <button
            className="lab-icon-button"
            type="button"
            onClick={() => move(-1)}
            disabled={frameIndex === 0}
            aria-label="이전 iteration"
            title="이전 iteration"
          >
            <ChevronLeft aria-hidden="true" size={17} />
          </button>
          <button
            className="lab-icon-button"
            type="button"
            onClick={() => move(1)}
            disabled={frameIndex === FRAMES.length - 1}
            aria-label="다음 iteration"
            title="다음 iteration"
          >
            <ChevronRight aria-hidden="true" size={17} />
          </button>
          <ResetButton onClick={() => setIteration("00")} />
        </>
      }
      controls={
        <SegmentedControl<IterationId>
          label="Incident iteration"
          value={iteration}
          options={FRAMES.map((item) => ({
            value: item.id,
            label: item.id,
          }))}
          onChange={setIteration}
        />
      }
      stageLabel={`Checkout API · iteration ${frame.id} · ${frame.phase}`}
      legend={[
        { label: "candidate patch", tone: "accent" },
        { label: "외부 실행 evidence", tone: "attention" },
        { label: "다음 호출에 보존", tone: "success" },
      ]}
      status={[
        { label: "Iteration", value: `${frame.id} / 03` },
        { label: "External signal", value: frame.externalSource },
        {
          label: "Retained evidence",
          value: `${frame.evidence.length}개 · context에 누적`,
        },
      ]}
      explanation={
        <>
          <strong>{frame.changesNextPatch ? "다음 patch가 바뀝니다." : frame.phase}</strong>{" "}
          {frame.explanation}
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="결제 API incident의 네 iteration과 evidence 흐름, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className="viz-svg viz-wide"
          viewBox="0 0 900 430"
          role="group"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <title id={titleId}>
            Patch, test, retained evidence로 이어지는 결제 API incident
          </title>
          <desc id={descriptionId}>
            Iteration 00부터 03까지 선택하며 candidate patch가 외부 test와
            명세에서 얻은 evidence에 따라 validator patch로 바뀌는 과정을
            보여줍니다.
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
            <marker
              id={successArrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-success)" />
            </marker>
          </defs>

          <text className="viz-eyebrow" x="44" y="28">
            INCIDENT TIMELINE · SELECT A FRAME
          </text>
          {FRAMES.map((item, index) => {
            const x = 44 + index * 210;
            const selected = item.id === iteration;
            const completed = index < frameIndex;
            return (
              <g
                key={item.id}
                className="viz-interactive"
                role="button"
                tabIndex={0}
                aria-label={`Iteration ${item.id}, ${item.phase}`}
                aria-pressed={selected}
                onClick={() => setIteration(item.id)}
                onKeyDown={(event) =>
                  activateOnKey(event, () => setIteration(item.id))
                }
              >
                <rect
                  x={x - 4}
                  y="39"
                  width="172"
                  height="58"
                  rx="9"
                  fill="transparent"
                />
                {index < FRAMES.length - 1 ? (
                  <path
                    className={
                      index < frameIndex
                        ? "viz-flow viz-flow-success"
                        : "viz-flow"
                    }
                    d={`M${x + 164} 66 H${x + 198}`}
                    markerEnd={
                      index < frameIndex
                        ? `url(#${successArrowId})`
                        : `url(#${arrowId})`
                    }
                  />
                ) : null}
                {selected ? (
                  <rect
                    className="viz-selection-halo"
                    x={x - 4}
                    y="39"
                    width="172"
                    height="58"
                    rx="9"
                    fill="none"
                    stroke="var(--fg-accent)"
                    strokeWidth="2"
                  />
                ) : null}
                <rect
                  className={`viz-node ${
                    selected
                      ? "viz-node-accent"
                      : completed
                        ? "viz-node-success"
                        : ""
                  }`}
                  x={x}
                  y="43"
                  width="164"
                  height="50"
                  rx="6"
                />
                <text className="viz-value" x={x + 14} y="65">
                  {item.id}
                </text>
                <text className="viz-body" x={x + 14} y="83">
                  {item.phase}
                </text>
              </g>
            );
          })}

          <rect className="viz-lane" x="28" y="116" width="844" height="196" rx="8" />

          <rect
            className="viz-node viz-node-accent"
            x="48"
            y="138"
            width="220"
            height="150"
            rx="6"
          />
          <text className="viz-eyebrow" x="68" y="164">
            PATCH / HYPOTHESIS
          </text>
          <text className="viz-title" x="68" y="192">
            {frame.patchLabel}
          </text>
          <rect
            className="viz-node"
            x="68"
            y="208"
            width="180"
            height="54"
            rx="5"
          />
          {frame.patchLines.map((line, index) => (
            <text
              className="viz-value"
              key={line}
              x="82"
              y={229 + index * 19}
            >
              {line}
            </text>
          ))}
          <text className="viz-body" x="68" y="281">
            {frame.action}
          </text>

          <path
            className="viz-flow viz-flow-accent"
            d="M268 213 H322"
            markerEnd={`url(#${accentArrowId})`}
          />

          <rect
            x="338"
            y="128"
            width="254"
            height="170"
            rx="7"
            fill="none"
            stroke="var(--fg-attention)"
            strokeDasharray="6 5"
          />
          <text
            className="viz-eyebrow"
            x="358"
            y="153"
            fill="var(--fg-attention)"
          >
            TOOL + EXTERNAL SYSTEM
          </text>
          {frame.checks.map((check, index) => {
            const y = 169 + index * 61;
            return (
              <g key={check.label}>
                <rect
                  className={`viz-node ${toneClass(check.tone)}`}
                  x="358"
                  y={y}
                  width="214"
                  height="49"
                  rx="6"
                />
                <text className="viz-eyebrow" x="374" y={y + 20}>
                  {check.label}
                </text>
                <text
                  className="viz-value"
                  x="556"
                  y={y + 20}
                  textAnchor="end"
                >
                  {check.result}
                </text>
                <text className="viz-body" x="374" y={y + 39}>
                  {check.detail}
                </text>
              </g>
            );
          })}

          <path
            className={
              frame.changesNextPatch
                ? "viz-flow viz-flow-success"
                : "viz-flow"
            }
            d="M592 213 H626"
            markerEnd={
              frame.changesNextPatch
                ? `url(#${successArrowId})`
                : `url(#${arrowId})`
            }
          />

          <rect
            className="viz-node viz-node-success"
            x="642"
            y="138"
            width="210"
            height="150"
            rx="6"
          />
          <text className="viz-eyebrow" x="662" y="164">
            RETAINED CONTEXT Hₜ
          </text>
          {frame.evidence.map((item, index) => (
            <g key={item}>
              <circle
                cx="668"
                cy={187 + index * 21}
                r="3.5"
                fill="var(--fg-success)"
              />
              <text
                className="viz-body"
                x="680"
                y={191 + index * 21}
              >
                {item}
              </text>
            </g>
          ))}

          <path
            className={
              frame.changesNextPatch
                ? "viz-flow viz-flow-success"
                : "viz-flow"
            }
            d="M747 312 V352 H158 V312"
            strokeDasharray="6 5"
            markerEnd={
              frame.changesNextPatch
                ? `url(#${successArrowId})`
                : `url(#${arrowId})`
            }
          />
          <rect
            className={
              frame.changesNextPatch
                ? "viz-node viz-node-success"
                : "viz-node"
            }
            x="248"
            y="338"
            width="404"
            height="58"
            rx="6"
          />
          <text className="viz-eyebrow" x="450" y="361" textAnchor="middle">
            NEXT MODEL CALL
          </text>
          <text className="viz-title" x="450" y="384" textAnchor="middle">
            {frame.changesNextPatch
              ? "외부 evidence가 다음 candidate의 조건을 바꿈"
              : frame.id === "03"
                ? "검증된 patch와 회귀 조건을 보존"
                : "목표와 실패 입력에서 첫 candidate 생성"}
          </text>
          <text className="viz-body" x="450" y="420" textAnchor="middle">
            반복 자체가 아니라 실행으로 얻은 새 정보와 그 정보의 보존이
            adaptive loop를 만듭니다.
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
