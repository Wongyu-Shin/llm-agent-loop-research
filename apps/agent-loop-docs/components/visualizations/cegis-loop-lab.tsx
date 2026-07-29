"use client";

import { Pause, Play, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LabShell, ResetButton, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type Stage = "idle" | "candidate" | "counterexample" | "accepted" | "unsat";

type Candidate = {
  id: string;
  label: string;
  code: string;
  run: (x: number) => boolean;
};

const DOMAIN = [-2, -1, 0, 1, 2, 3, 4, 5];
const SUBTOTAL = 3;
const SPEC = (discount: number) => discount >= 0 && discount <= SUBTOTAL;

const CANDIDATES: Candidate[] = [
  { id: "p0", label: "always accept", code: "return true", run: () => true },
  { id: "p1", label: "lower bound", code: "return d >= 0", run: (x) => x >= 0 },
  { id: "p2", label: "upper bound", code: "return d <= subtotal", run: (x) => x <= SUBTOTAL },
  {
    id: "p3",
    label: "two-sided guard",
    code: "return 0 <= d && d <= subtotal",
    run: SPEC,
  },
  { id: "p4", label: "always reject", code: "return false", run: () => false },
];

function evidenceEntries(evidence: Record<number, boolean>) {
  return Object.entries(evidence).map(([x, expected]) => [Number(x), expected] as const);
}

function consistent(candidate: Candidate, evidence: Record<number, boolean>) {
  return evidenceEntries(evidence).every(([x, expected]) => candidate.run(x) === expected);
}

export function CegisLoopLab() {
  const [evidence, setEvidence] = useState<Record<number, boolean>>({});
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [iteration, setIteration] = useState(0);
  const [lastCounterexample, setLastCounterexample] = useState<number | null>(null);
  const [message, setMessage] = useState("합성할 evidence set은 비어 있습니다.");
  const [auto, setAuto] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const svgPrefix = useSvgIdPrefix("cegis-loop");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;
  const successArrowId = `${svgPrefix}-arrow-success`;
  const dangerArrowId = `${svgPrefix}-arrow-danger`;

  const survivors = useMemo(
    () => CANDIDATES.filter((candidate) => consistent(candidate, evidence)),
    [evidence],
  );
  const candidate = CANDIDATES.find((item) => item.id === candidateId) ?? null;

  const synthesize = useCallback(() => {
    const nextCandidate = CANDIDATES.find((item) => consistent(item, evidence));
    if (!nextCandidate) {
      setCandidateId(null);
      setStage("unsat");
      setMessage("현재 grammar에는 evidence를 만족하는 후보가 없습니다.");
      setAuto(false);
      return;
    }

    setCandidateId(nextCandidate.id);
    setStage("candidate");
    setIteration((current) => current + 1);
    setMessage(`${nextCandidate.id}가 누적 counterexample을 모두 만족합니다.`);
  }, [evidence]);

  const verify = useCallback(() => {
    if (!candidate) return;
    const counterexample = DOMAIN.find((x) => candidate.run(x) !== SPEC(x));
    if (counterexample === undefined) {
      setStage("accepted");
      setLastCounterexample(null);
      setMessage(`finite domain ${DOMAIN[0]}..${DOMAIN[DOMAIN.length - 1]}에서 ${candidate.id} 검증을 마쳤습니다.`);
      setAuto(false);
      return;
    }

    const expected = SPEC(counterexample);
    setEvidence((current) => ({ ...current, [counterexample]: expected }));
    setLastCounterexample(counterexample);
    setStage("counterexample");
    setMessage(`discount=${counterexample}: expected ${expected ? "accept" : "reject"}, actual ${candidate.run(counterexample) ? "accept" : "reject"}`);
  }, [candidate]);

  useEffect(() => {
    if (!auto || stage === "accepted" || stage === "unsat") return;
    const timer = window.setTimeout(() => {
      if (stage === "candidate") {
        verify();
      } else {
        synthesize();
      }
    }, 720);
    return () => window.clearTimeout(timer);
  }, [auto, stage, synthesize, verify]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(media.matches);
      if (media.matches) setAuto(false);
    };

    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  function reset() {
    setEvidence({});
    setCandidateId(null);
    setStage("idle");
    setIteration(0);
    setLastCounterexample(null);
    setMessage("합성할 evidence set은 비어 있습니다.");
    setAuto(false);
  }

  return (
    <LabShell
      title="실패한 할인값을 보존하는 CEGIS loop"
      subtitle="Validation rule을 합성하고 verifier가 찾은 counterexample을 다음 후보의 제약으로 추가합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <div className="control-group">
          <span className="control-label">Loop control</span>
          <div className="lab-action-row">
            <button
              className="lab-button"
              type="button"
              onClick={synthesize}
              disabled={stage === "candidate" || stage === "accepted" || stage === "unsat" || auto}
            >
              <Sparkles aria-hidden="true" size={14} />
              합성
            </button>
            <button className="lab-button" type="button" onClick={verify} disabled={stage !== "candidate" || auto}>
              <ShieldCheck aria-hidden="true" size={14} />
              검증
            </button>
            <button
              className={auto ? "lab-button" : "lab-button primary"}
              type="button"
              onClick={() => setAuto((current) => !current)}
              disabled={stage === "accepted" || stage === "unsat" || prefersReducedMotion}
              title={prefersReducedMotion ? "모션 축소 설정에서는 단계별 수동 실행을 사용합니다." : undefined}
            >
              {auto ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
              {auto ? "일시정지" : "자동 실행"}
            </button>
          </div>
        </div>
      }
      stageLabel="Synthesis-verification cycle"
      legend={[
        { label: "합성 단계", tone: "accent" },
        { label: "검증 단계", tone: "attention" },
        { label: "반례", tone: "danger" },
      ]}
      status={[
        { label: "Iterations", value: String(iteration) },
        { label: "Counterexamples", value: String(Object.keys(evidence).length) },
        { label: "Candidate set", value: `${survivors.length} / ${CANDIDATES.length}` },
      ]}
      explanation={
        <>
          Verifier: <strong>{message}</strong>
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="CEGIS 합성과 검증 순환, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide cegis-svg" viewBox="0 0 900 470" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>결제 API validation rule을 만드는 CEGIS loop</title>
          <desc id={descriptionId}>누적 counterexample로 validation 후보를 합성하고 finite discount domain에서 검증하는 과정을 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--line-strong)" />
            </marker>
            <marker id={successArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-success)" />
            </marker>
            <marker id={dangerArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-danger)" />
            </marker>
          </defs>

          <rect className="viz-shape" x="48" y="30" width="804" height="58" rx="6" fill="var(--bg-subtle)" stroke="var(--border-default)" strokeWidth="1.5" />
          <text x="68" y="53" className="muted-text mono" fontSize="9">SPECIFICATION Φ(p, x)</text>
          <text x="68" y="75" className="mono" fontSize="12">∀discount ∈ [-2,5], p(discount) = (0 ≤ discount ≤ subtotal=3)</text>
          <text x="830" y="65" textAnchor="end" className="muted-text mono" fontSize="10">FINITE DOMAIN</text>

          <g className={stage === "idle" || stage === "counterexample" ? "cegis-block is-active" : "cegis-block"}>
            {stage === "idle" || stage === "counterexample" ? <rect className="viz-selection-halo" x="51" y="138" width="198" height="162" rx="8" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
            <rect className="viz-shape" x="55" y="142" width="190" height="154" rx="6" fill="var(--bg-accent-muted)" stroke="var(--border-emphasis)" strokeWidth="1.5" />
            <text x="78" y="171" className="muted-text mono" fontSize="9">SYNTHESIZER</text>
            <text x="78" y="203" fontSize="15" fontWeight="760">Inductive step</text>
            <text x="78" y="231" className="mono" fontSize="10">find p ∈ C</text>
            <text x="78" y="251" className="mono" fontSize="10">s.t. ∀e ∈ Eₜ, Φ(p,e)</text>
            <text x="78" y="278" className="muted-text" fontSize="10">남은 후보 {survivors.length}개</text>
          </g>

          <path d="M245 219 H323" fill="none" stroke="var(--line-strong)" strokeWidth="2" markerEnd={`url(#${arrowId})`} />

          <g className={stage === "candidate" ? "cegis-block is-active" : "cegis-block"}>
            {stage === "candidate" ? <rect className="viz-selection-halo" x="336" y="138" width="228" height="162" rx="8" fill="none" stroke="var(--fg-attention)" strokeWidth="2" /> : null}
            <rect className="viz-shape" x="340" y="142" width="220" height="154" rx="6" fill="var(--bg-canvas)" stroke="var(--border-emphasis)" strokeWidth="1.5" />
            <text x="363" y="171" className="muted-text mono" fontSize="9">CANDIDATE pₜ</text>
            <text x="363" y="204" fontSize="16" fontWeight="760">{candidate ? `${candidate.id} · ${candidate.label}` : "not synthesized"}</text>
            <rect x="363" y="225" width="174" height="42" rx="5" fill="var(--bg-subtle)" stroke="var(--border-default)" />
            <text x="450" y="251" textAnchor="middle" className="mono" fontSize="9">{candidate?.code ?? "return ?"}</text>
            <text x="363" y="282" className="muted-text" fontSize="10">iteration {iteration}</text>
          </g>

          <path className="viz-edge" d="M560 219 H638" fill="none" stroke="var(--fg-success)" strokeWidth="1.5" markerEnd={`url(#${successArrowId})`} />

          <g className={stage === "accepted" ? "cegis-block is-accepted" : stage === "candidate" ? "cegis-block is-active" : "cegis-block"}>
            {stage === "accepted" || stage === "candidate" ? <rect className="viz-selection-halo" x="651" y="138" width="198" height="162" rx="8" fill="none" stroke={stage === "accepted" ? "var(--fg-success)" : "var(--fg-attention)"} strokeWidth="2" /> : null}
            <rect className="viz-shape" x="655" y="142" width="190" height="154" rx="6" fill={stage === "accepted" ? "var(--bg-success-muted)" : "var(--bg-attention-muted)"} stroke="var(--border-emphasis)" strokeWidth="1.5" />
            <text x="678" y="171" className="muted-text mono" fontSize="9">VERIFIER</text>
            <text x="678" y="203" fontSize="15" fontWeight="760">Deductive check</text>
            <text x="678" y="231" className="mono" fontSize="10">find x</text>
            <text x="678" y="251" className="mono" fontSize="10">s.t. ¬Φ(pₜ, x)</text>
            <text x="678" y="279" fontSize="11" fill={stage === "accepted" ? "var(--fg-success)" : "var(--ink-soft)"}>
              {stage === "accepted" ? "FINITE-SCOPE PASS" : "search domain [-2,5]"}
            </text>
          </g>

          <path className="viz-edge" d="M750 296 C750 378 175 378 150 296" fill="none" stroke={lastCounterexample === null ? "var(--line-strong)" : "var(--fg-danger)"} strokeWidth="1.5" strokeDasharray="7 6" markerEnd={lastCounterexample === null ? `url(#${arrowId})` : `url(#${dangerArrowId})`} />

          <g className="cegis-evidence">
            <rect x="206" y="344" width="488" height="88" rx="7" fill="var(--surface-subtle)" stroke="var(--line)" />
            <text x="226" y="368" className="muted-text mono" fontSize="9">COUNTEREXAMPLE STORE Eₜ</text>
            {evidenceEntries(evidence).length ? (
              evidenceEntries(evidence).map(([x, expected], index) => (
                <g key={x} transform={`translate(${230 + index * 112} 386)`}>
                  <rect width="98" height="28" rx="5" fill={lastCounterexample === x ? "var(--bg-danger-muted)" : "var(--bg-canvas)"} stroke={lastCounterexample === x ? "var(--fg-danger)" : "var(--border-default)"} />
                  <text x="49" y="18" textAnchor="middle" className="mono" fontSize="9">d={x} → {expected ? "accept" : "reject"}</text>
                </g>
              ))
            ) : (
              <text x="226" y="404" className="muted-text" fontSize="11">∅ · 첫 candidate는 전체 grammar에서 선택됩니다.</text>
            )}
          </g>

          <text x="450" y="458" textAnchor="middle" className="mono muted-text" fontSize="10">
            synthesize(Eₜ) → verify(pₜ) → Eₜ₊₁ = Eₜ ∪ &#123;counterexample&#125;
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
