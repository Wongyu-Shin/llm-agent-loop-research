"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { LabShell, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type LoopStep = "goal" | "candidate" | "action" | "observation" | "update";
const INITIAL_STEP: LoopStep = "observation";

const STEPS: Array<{
  id: LoopStep;
  short: string;
  title: string;
  eyebrow: string;
  body: string[];
  retained: string;
  x: number;
}> = [
  {
    id: "goal",
    short: "목표",
    title: "Goal",
    eyebrow: "CONTEXT",
    body: ["음수 total을", "막아야 한다"],
    retained: "사용자 목표와 재현 요청",
    x: 40,
  },
  {
    id: "candidate",
    short: "후보",
    title: "Candidate",
    eyebrow: "MODEL OUTPUT",
    body: ["Math.max로", "total을 clamp"],
    retained: "현재 patch와 가설",
    x: 206,
  },
  {
    id: "action",
    short: "실행",
    title: "Action",
    eyebrow: "HARNESS",
    body: ["unit test와", "contract test 실행"],
    retained: "실행한 명령과 diff",
    x: 372,
  },
  {
    id: "observation",
    short: "관찰",
    title: "Observation",
    eyebrow: "ENVIRONMENT",
    body: ["unit PASS", "contract FAIL"],
    retained: "expected 400, received 200",
    x: 538,
  },
  {
    id: "update",
    short: "갱신",
    title: "State update",
    eyebrow: "NEXT CONTEXT",
    body: ["clamp가 아니라", "validator가 필요"],
    retained: "반례와 계약 조건",
    x: 704,
  },
];

function stepIndex(step: LoopStep) {
  return STEPS.findIndex((item) => item.id === step);
}

export function AgentLoopAnatomy() {
  const [step, setStep] = useState<LoopStep>(INITIAL_STEP);
  const index = stepIndex(step);
  const active = STEPS[index];
  const svgPrefix = useSvgIdPrefix("agent-loop");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;
  const accentArrowId = `${svgPrefix}-arrow-accent`;

  function move(delta: number) {
    const next = Math.max(0, Math.min(STEPS.length - 1, index + delta));
    setStep(STEPS[next].id);
  }

  return (
    <LabShell
      title="실행 결과를 다음 판단에 반영하는 agent loop"
      subtitle="목표 설정부터 후보 생성, 실행, 관찰, state update까지 한 iteration에서 바뀌는 정보를 확인합니다."
      actions={
        <>
          <button className="lab-icon-button" type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="이전 단계" title="이전 단계">
            <ChevronLeft aria-hidden="true" size={17} />
          </button>
          <button className="lab-icon-button" type="button" onClick={() => move(1)} disabled={index === STEPS.length - 1} aria-label="다음 단계" title="다음 단계">
            <ChevronRight aria-hidden="true" size={17} />
          </button>
          <ResetButton onClick={() => setStep(INITIAL_STEP)} />
        </>
      }
      controls={
        <SegmentedControl<LoopStep>
          label="Iteration 단계"
          value={step}
          options={STEPS.map((item) => ({ value: item.id, label: item.short }))}
          onChange={setStep}
        />
      }
      stageLabel="Iteration 01 · checkout API"
      legend={[
        { label: "context 내부", tone: "accent" },
        { label: "외부 실행", tone: "attention" },
        { label: "보존된 evidence", tone: "success" },
      ]}
      status={[
        { label: "현재 단계", value: `${index + 1} / ${STEPS.length} · ${active.short}` },
        { label: "새 정보 출처", value: step === "observation" ? "test runner" : step === "action" ? "없음 · 실행 중" : "누적 context" },
        { label: "다음 호출에 남는 것", value: active.retained },
      ]}
      explanation={
        <>
          선택한 단계: <strong>{active.title}</strong> · observation이 들어온 뒤에야 다음 candidate의 조건이 달라집니다.
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="Agent loop 한 바퀴의 다섯 단계, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide agent-loop-anatomy-svg" viewBox="0 0 900 390" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>목표에서 상태 갱신까지 이어지는 agent iteration</title>
          <desc id={descriptionId}>목표, 후보, 실행, 관찰, 상태 갱신의 다섯 단계와 context 및 외부 환경의 경계를 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
            </marker>
            <marker id={accentArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-accent)" />
            </marker>
          </defs>

          <rect className="viz-lane" x="24" y="20" width="852" height="254" rx="8" />
          <text className="viz-eyebrow" x="44" y="48">ONE ADAPTIVE ITERATION</text>

          <rect x="350" y="56" width="332" height="166" rx="8" fill="none" stroke="var(--fg-attention)" strokeDasharray="6 5" />
          <text className="viz-eyebrow" x="366" y="79" fill="var(--fg-attention)">TOOL + EXTERNAL SYSTEM</text>

          {STEPS.slice(0, -1).map((item, itemIndex) => {
            const next = STEPS[itemIndex + 1];
            const passed = itemIndex < index;
            return (
              <path
                key={`${item.id}-${next.id}`}
                className={passed ? "viz-flow viz-flow-accent" : "viz-flow"}
                d={`M${item.x + 132} 148 H${next.x - 12}`}
                markerEnd={passed ? `url(#${accentArrowId})` : `url(#${arrowId})`}
              />
            );
          })}

          {STEPS.map((item, itemIndex) => {
            const selected = item.id === step;
            const completed = itemIndex < index;
            const toneClass = selected ? "viz-node-accent" : completed ? "viz-node-success" : item.id === "action" || item.id === "observation" ? "viz-node-attention" : "";
            return (
              <g
                key={item.id}
                className="viz-interactive"
                role="button"
                tabIndex={0}
                aria-label={`${itemIndex + 1}단계 ${item.short}`}
                aria-pressed={selected}
                onClick={() => setStep(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setStep(item.id);
                  }
                }}
              >
                {selected ? <rect className="viz-selection-halo" x={item.x - 4} y="91" width="140" height="122" rx="9" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
                <rect className={`viz-node ${toneClass}`} x={item.x} y="95" width="132" height="114" rx="6" />
                <text className="viz-eyebrow" x={item.x + 14} y="119">{item.eyebrow}</text>
                <text className="viz-title" x={item.x + 14} y="146">{item.title}</text>
                {item.body.map((line, lineIndex) => (
                  <text className="viz-body" key={line} x={item.x + 14} y={174 + lineIndex * 18}>{line}</text>
                ))}
                <circle cx={item.x + 116} cy="111" r="10" fill={selected ? "var(--bg-accent-emphasis)" : completed ? "var(--fg-success)" : "var(--bg-subtle)"} stroke={selected ? "var(--bg-accent-emphasis)" : completed ? "var(--fg-success)" : "var(--border-default)"} />
                <text x={item.x + 116} y="115" textAnchor="middle" fontSize="10" fontWeight="700" fill={selected || completed ? "var(--fg-on-emphasis)" : "var(--fg-muted)"}>{itemIndex + 1}</text>
              </g>
            );
          })}

          <path className="viz-flow viz-flow-success" d="M770 274 V302 H130 V274" strokeDasharray="6 5" markerEnd={`url(#${arrowId})`} />
          <text className="viz-eyebrow" x="450" y="324" textAnchor="middle">RETAINED FOR THE NEXT MODEL CALL</text>
          <text className="viz-title" x="450" y="352" textAnchor="middle">{active.retained}</text>
          <text className="viz-body" x="450" y="375" textAnchor="middle">
            context는 기록을 담고, repository와 test runner는 실행 결과를 만듭니다.
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
