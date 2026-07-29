"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { LabShell, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type MemoryMode = "retain" | "drop";

type Frame = {
  candidate: string;
  phase: "synthesize" | "verify" | "counterexample" | "accepted";
  evidence: string[];
  removed: string[];
  message: string;
};

const RETAINED_FRAMES: Frame[] = [
  {
    candidate: "p₀ · return true",
    phase: "synthesize",
    evidence: [],
    removed: [],
    message: "빈 evidence에서 첫 candidate를 고릅니다.",
  },
  {
    candidate: "p₀ · return true",
    phase: "counterexample",
    evidence: ["d=-1 → reject"],
    removed: ["p₀"],
    message: "Verifier가 음수 할인 반례를 찾았습니다.",
  },
  {
    candidate: "p₁ · d ≥ 0",
    phase: "verify",
    evidence: ["d=-1 → reject"],
    removed: ["p₀"],
    message: "새 candidate는 첫 반례를 통과합니다.",
  },
  {
    candidate: "p₁ · d ≥ 0",
    phase: "counterexample",
    evidence: ["d=-1 → reject", "d=4 → reject"],
    removed: ["p₀", "p₁", "p₂"],
    message: "상한을 위반하는 두 번째 반례를 보존합니다.",
  },
  {
    candidate: "p₃ · 0 ≤ d ≤ subtotal",
    phase: "accepted",
    evidence: ["d=-1 → reject", "d=4 → reject"],
    removed: ["p₀", "p₁", "p₂"],
    message: "두 반례를 만족하고 specification 검증까지 통과한 candidate를 찾았습니다.",
  },
];

const DROPPED_FRAMES: Frame[] = [
  RETAINED_FRAMES[0],
  RETAINED_FRAMES[1],
  RETAINED_FRAMES[2],
  {
    candidate: "p₁ · d ≥ 0",
    phase: "counterexample",
    evidence: ["d=4 → reject"],
    removed: ["p₀", "p₁"],
    message: "새 반례를 저장하면서 d=-1을 잊었습니다.",
  },
  {
    candidate: "p₂ · d ≤ subtotal",
    phase: "verify",
    evidence: ["d=4 → reject"],
    removed: ["p₀", "p₁"],
    message: "p₂는 d=4를 처리하지만 다시 d=-1에서 실패합니다.",
  },
];

const CANDIDATES = [
  { id: "p₀", rule: "always accept" },
  { id: "p₁", rule: "d ≥ 0" },
  { id: "p₂", rule: "d ≤ subtotal" },
  { id: "p₃", rule: "two-sided" },
  { id: "p₄", rule: "always reject" },
];

export function CegisRetentionExplorer() {
  const [mode, setMode] = useState<MemoryMode>("retain");
  const [step, setStep] = useState(0);
  const frames = mode === "retain" ? RETAINED_FRAMES : DROPPED_FRAMES;
  const frame = frames[step];
  const svgPrefix = useSvgIdPrefix("cegis-retention");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;

  const currentCandidateId = frame.candidate.slice(0, 2);
  const monotonic = mode === "retain";
  const phaseLabel = useMemo(() => {
    if (frame.phase === "synthesize") return "Learner";
    if (frame.phase === "verify") return "Verifier";
    if (frame.phase === "counterexample") return "Counterexample store";
    return "Accepted";
  }, [frame.phase]);

  function setMemoryMode(next: MemoryMode) {
    setMode(next);
    setStep(0);
  }

  function move(delta: number) {
    setStep((current) => Math.max(0, Math.min(frames.length - 1, current + delta)));
  }

  function reset() {
    setMode("retain");
    setStep(0);
  }

  return (
    <LabShell
      title="반례 보존 여부에 따른 candidate set 변화"
      subtitle="모든 반례를 누적할 때와 최신 반례만 남길 때 이전 실패가 다시 나타나는지 비교합니다."
      actions={
        <>
          <button className="lab-icon-button" type="button" onClick={() => move(-1)} disabled={step === 0} aria-label="이전 CEGIS 단계" title="이전 CEGIS 단계">
            <ChevronLeft aria-hidden="true" size={17} />
          </button>
          <button className="lab-icon-button" type="button" onClick={() => move(1)} disabled={step === frames.length - 1} aria-label="다음 CEGIS 단계" title="다음 CEGIS 단계">
            <ChevronRight aria-hidden="true" size={17} />
          </button>
          <ResetButton onClick={reset} />
        </>
      }
      controls={
        <>
          <SegmentedControl<MemoryMode>
            label="Counterexample memory"
            value={mode}
            options={[
              { value: "retain", label: "모두 보존" },
              { value: "drop", label: "최신 반례만" },
            ]}
            onChange={setMemoryMode}
          />
          <SegmentedControl<string>
            label="Iteration frame"
            value={String(step)}
            options={frames.map((_, index) => ({ value: String(index), label: String(index) }))}
            onChange={(value) => setStep(Number(value))}
          />
        </>
      }
      stageLabel={`CEGIS · frame ${step} · ${phaseLabel}`}
      legend={[
        { label: "현재 candidate", tone: "accent" },
        { label: "보존된 반례", tone: "danger" },
        { label: "검증 완료", tone: "success" },
      ]}
      status={[
        { label: "Evidence set", value: frame.evidence.length ? `{ ${frame.evidence.join(", ")} }` : "∅" },
        { label: "Candidate", value: frame.candidate },
        { label: "Progress", value: monotonic ? "Cₜ₊₁ ⊆ Cₜ 유지" : step >= 3 ? "이전 실패가 다시 가능" : "아직 차이 없음" },
      ]}
      explanation={
        <>
          <strong>{frame.message}</strong> {mode === "drop" && step === frames.length - 1 ? "다음 검증에서는 d=-1 반례가 다시 나옵니다." : null}
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="CEGIS 반례 보존 비교 도식, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide cegis-retention-svg" viewBox="0 0 900 430" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>반례 보존 여부에 따른 CEGIS candidate 진행</title>
          <desc id={descriptionId}>반례를 모두 보존하면 candidate set이 줄고, 최신 반례만 남기면 이전 실패가 다시 나타날 수 있음을 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
            </marker>
          </defs>

          <rect className="viz-lane" x="32" y="24" width="836" height="82" rx="8" />
          <text className="viz-eyebrow" x="52" y="51">CANDIDATE SPACE Cₜ</text>
          {CANDIDATES.map((candidate, index) => {
            const x = 52 + index * 158;
            const removed = frame.removed.includes(candidate.id);
            const current = candidate.id === currentCandidateId;
            return (
              <g key={candidate.id} opacity={removed && !current ? 0.32 : 1}>
                <rect className={`viz-node ${current ? "viz-node-accent" : ""}`} x={x} y="64" width="140" height="28" rx="5" />
                <text className="viz-value" x={x + 10} y="83">{candidate.id}</text>
                <text className="viz-body" x={x + 38} y="83">{candidate.rule}</text>
                {removed ? <path className="viz-flow viz-flow-danger" d={`M${x + 6} 69 L${x + 134} 87`} /> : null}
              </g>
            );
          })}

          <rect className={`viz-node ${frame.phase === "synthesize" ? "viz-node-accent" : ""}`} x="48" y="158" width="178" height="104" rx="6" />
          <text className="viz-eyebrow" x="68" y="186">LEARNER</text>
          <text className="viz-title" x="68" y="214">Synthesize(Eₜ)</text>
          <text className="viz-body" x="68" y="240">evidence와 일관된 후보</text>

          <path className="viz-flow" d="M226 210 H300" markerEnd={`url(#${arrowId})`} />
          <rect className={`viz-node ${frame.phase === "verify" ? "viz-node-accent" : ""}`} x="316" y="158" width="268" height="104" rx="6" />
          <text className="viz-eyebrow" x="336" y="186">CANDIDATE pₜ</text>
          <text className="viz-title" x="336" y="216">{frame.candidate}</text>
          <text className="viz-body" x="336" y="242">frame {step}에서 검증할 program</text>

          <path className="viz-flow" d="M584 210 H658" markerEnd={`url(#${arrowId})`} />
          <rect className={`viz-node ${frame.phase === "accepted" ? "viz-node-success" : frame.phase === "counterexample" ? "viz-node-danger" : ""}`} x="674" y="158" width="178" height="104" rx="6" />
          <text className="viz-eyebrow" x="694" y="186">VERIFIER</text>
          <text className="viz-title" x="694" y="214">{frame.phase === "accepted" ? "FINITE PASS" : "Find ¬Φ(pₜ,x)"}</text>
          <text className="viz-body" x="694" y="240">{frame.phase === "counterexample" ? "concrete input 반환" : "finite domain 검사"}</text>

          <path className={frame.phase === "counterexample" ? "viz-flow viz-flow-danger" : "viz-flow"} d="M762 262 C762 330 138 330 138 262" strokeDasharray="6 5" markerEnd={`url(#${arrowId})`} />
          <rect className={`viz-node ${frame.evidence.length ? "viz-node-danger" : ""}`} x="214" y="304" width="472" height="82" rx="6" />
          <text className="viz-eyebrow" x="236" y="332">COUNTEREXAMPLE STORE Eₜ</text>
          {frame.evidence.length ? (
            frame.evidence.map((evidence, index) => (
              <g key={evidence}>
                <rect className="viz-node" x={236 + index * 192} y="346" width="174" height="26" rx="5" />
                <text className="viz-value" x={248 + index * 192} y="364">{evidence}</text>
              </g>
            ))
          ) : (
            <text className="viz-body" x="236" y="362">∅ · 첫 candidate는 전체 grammar에서 선택</text>
          )}

          <text className="viz-body" x="450" y="414" textAnchor="middle">
            {monotonic ? "Eₜ ⊆ Eₜ₊₁이면 이전 counterexample을 깨는 후보는 돌아오지 못합니다." : "Eₜ를 덮어쓰면 candidate set의 단조 감소를 주장할 수 없습니다."}
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
