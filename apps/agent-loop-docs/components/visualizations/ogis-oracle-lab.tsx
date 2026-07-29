"use client";

import { Eye, EyeOff, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { LabShell, RangeControl, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type QueryType = "membership" | "example" | "equivalence";

type Hypothesis = {
  id: string;
  label: string;
  short: string;
  test: (x: number) => boolean;
};

const SUBTOTAL = 3;
const DOMAIN = [-2, -1, 0, 1, 2, 3, 4, 5];
const TARGET = (discount: number) => discount >= 0 && discount <= SUBTOTAL;

const HYPOTHESES: Hypothesis[] = [
  { id: "h0", label: "항상 허용", short: "return true", test: () => true },
  { id: "h1", label: "0 이상", short: "d ≥ 0", test: (x) => x >= 0 },
  { id: "h2", label: "subtotal 이하", short: "d ≤ subtotal", test: (x) => x <= SUBTOTAL },
  { id: "h3", label: "양수 범위", short: "0 < d ≤ subtotal", test: (x) => x > 0 && x <= SUBTOTAL },
  { id: "h4", label: "상한 미만", short: "0 ≤ d < subtotal", test: (x) => x >= 0 && x < SUBTOTAL },
  { id: "h5", label: "1 이상", short: "1 ≤ d ≤ subtotal", test: (x) => x >= 1 && x <= SUBTOTAL },
  { id: "h6", label: "양쪽 경계", short: "0 ≤ d ≤ subtotal", test: TARGET },
  { id: "h7", label: "항상 거부", short: "return false", test: () => false },
];

function evidenceEntries(evidence: Record<number, boolean>) {
  return Object.entries(evidence).map(([x, label]) => [Number(x), label] as const);
}

function isConsistent(hypothesis: Hypothesis, evidence: Record<number, boolean>) {
  return evidenceEntries(evidence).every(([x, label]) => hypothesis.test(x) === label);
}

function booleanLabel(value: boolean) {
  return value ? "accept" : "reject";
}

export function OgisOracleLab() {
  const [queryType, setQueryType] = useState<QueryType>("equivalence");
  const [selectedInput, setSelectedInput] = useState(2);
  const [evidence, setEvidence] = useState<Record<number, boolean>>({});
  const [response, setResponse] = useState("oracle response가 아직 없습니다.");
  const [queryCount, setQueryCount] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [revealTarget, setRevealTarget] = useState(false);
  const svgPrefix = useSvgIdPrefix("ogis-oracle");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;
  const attentionArrowId = `${svgPrefix}-arrow-attention`;

  const survivors = useMemo(
    () => HYPOTHESES.filter((hypothesis) => isConsistent(hypothesis, evidence)),
    [evidence],
  );
  const candidate = survivors[0] ?? null;

  function addEvidence(x: number, label: boolean) {
    setEvidence((current) => ({ ...current, [x]: label }));
  }

  function queryOracle() {
    if (!candidate) {
      setResponse("현재 evidence와 일관된 후보가 없습니다.");
      return;
    }

    setQueryCount((current) => current + 1);
    setAccepted(false);

    if (queryType === "membership") {
      const label = TARGET(selectedInput);
      addEvidence(selectedInput, label);
      setResponse(`membership(${selectedInput}) = ${String(label)}`);
      return;
    }

    if (queryType === "example") {
      const unknown = DOMAIN.filter((x) => evidence[x] === undefined);
      const disagreement = unknown.find((x) => {
        const labels = new Set(survivors.map((hypothesis) => hypothesis.test(x)));
        return labels.size > 1;
      });
      const x = disagreement ?? unknown[0];
      if (x === undefined) {
        setResponse("새 example이 없습니다.");
        return;
      }
      const label = TARGET(x);
      addEvidence(x, label);
      setResponse(`example: (${x}, ${String(label)})`);
      return;
    }

    const counterexample = DOMAIN.find((x) => candidate.test(x) !== TARGET(x));
    if (counterexample === undefined) {
      setAccepted(true);
      setResponse(`finite-domain equivalent: ${candidate.id} accepted`);
      return;
    }

    const label = TARGET(counterexample);
    addEvidence(counterexample, label);
    setResponse(`not equivalent: counterexample x=${counterexample}, y=${String(label)}`);
  }

  function reset() {
    setQueryType("equivalence");
    setSelectedInput(2);
    setEvidence({});
    setResponse("oracle response가 아직 없습니다.");
    setQueryCount(0);
    setAccepted(false);
    setRevealTarget(false);
  }

  function changeQueryType(nextQueryType: QueryType) {
    setQueryType(nextQueryType);
    setAccepted(false);
    setResponse(
      nextQueryType === "membership"
        ? "input을 선택한 뒤 Oracle 질의를 실행하세요."
        : `${nextQueryType} query를 실행할 준비가 되었습니다.`,
    );
  }

  return (
    <LabShell
      title="할인 validation 후보를 줄이는 oracle 질의"
      subtitle="Membership, example, equivalence 응답을 누적해 계약과 모순되는 후보를 제거합니다."
      actions={
        <>
          <button
            className="lab-icon-button"
            type="button"
            onClick={() => setRevealTarget((current) => !current)}
            aria-label={revealTarget ? "target 숨기기" : "target 보기"}
            title={revealTarget ? "target 숨기기" : "target 보기"}
          >
            {revealTarget ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
          </button>
          <button className="lab-button primary" type="button" onClick={queryOracle} disabled={!candidate || accepted}>
            <Send aria-hidden="true" size={14} />
            Oracle 질의
          </button>
          <ResetButton onClick={reset} />
        </>
      }
      controls={
        <>
          <SegmentedControl<QueryType>
            label="Query"
            value={queryType}
            options={[
              { value: "membership", label: "Membership" },
              { value: "example", label: "Example" },
              { value: "equivalence", label: "Equivalence" },
            ]}
            onChange={changeQueryType}
          />
          <RangeControl
            id="ogis-input"
            label="Membership input"
            value={selectedInput}
            min={-2}
            max={5}
            step={1}
            valueLabel={`discount ${selectedInput}`}
            onChange={setSelectedInput}
          />
        </>
      }
      stageLabel="Learner-oracle protocol"
      legend={[
        { label: "현재 candidate", tone: "accent" },
        { label: "oracle", tone: "attention" },
        { label: "탈락 candidate", tone: "danger" },
      ]}
      status={[
        { label: "Queries", value: String(queryCount) },
        { label: "Evidence", value: String(Object.keys(evidence).length) },
        { label: "Version space", value: `${survivors.length} / ${HYPOTHESES.length}` },
      ]}
      explanation={
        <>
          Oracle: <strong>{response}</strong>
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="OGIS learner와 oracle protocol, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide ogis-svg" viewBox="0 0 900 480" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>결제 API validation learner와 oracle의 질의 응답</title>
          <desc id={descriptionId}>여덟 개 validation 가설 중 evidence와 일관된 version space, 현재 learner 후보, oracle 응답을 보여줍니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--line-strong)" />
            </marker>
            <marker id={attentionArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-attention)" />
            </marker>
          </defs>

          <text x="56" y="35" className="muted-text mono" fontSize="10">DISCOUNT DOMAIN · SUBTOTAL 3</text>
          {DOMAIN.map((x, index) => {
            const label = evidence[x];
            const known = label !== undefined;
            const fill = !known ? "var(--bg-canvas)" : label ? "var(--bg-success-muted)" : "var(--bg-danger-muted)";
            const stroke = !known ? "var(--border-emphasis)" : label ? "var(--fg-success)" : "var(--fg-danger)";
            return (
              <g
                key={x}
                transform={`translate(${92 + index * 72} 70)`}
                role="button"
                tabIndex={0}
                aria-pressed={selectedInput === x}
                aria-label={`x=${x}${known ? `, ${booleanLabel(label)}` : ", unknown"}. Membership input으로 선택`}
                onClick={() => setSelectedInput(x)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedInput(x);
                  }
                }}
              >
                <circle r="30" fill="transparent" />
                {selectedInput === x ? <circle className="viz-selection-halo" r="25" fill="none" stroke="var(--fg-accent)" strokeWidth="2" /> : null}
                <circle className="viz-shape" r="21" fill={fill} stroke={stroke} strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" className="mono" fontSize="11">{x}</text>
                <text x="0" y="39" textAnchor="middle" className="mono muted-text" fontSize="9">
                  {known ? (label ? "accept" : "reject") : "?"}
                </text>
              </g>
            );
          })}

          <g className="ogis-learner">
            <rect className="viz-shape" x="48" y="155" width="180" height="154" rx="6" fill="var(--bg-accent-muted)" stroke="var(--fg-accent)" strokeWidth="1.5" />
            <text x="70" y="185" className="muted-text mono" fontSize="9">LEARNER</text>
            <text x="70" y="215" fontSize="15" fontWeight="760">현재 candidate</text>
            <rect x="70" y="235" width="136" height="40" rx="5" fill="var(--bg-canvas)" stroke="var(--border-default)" />
            <text x="138" y="260" textAnchor="middle" className="mono" fontSize="11">
              {candidate ? `${candidate.id}: ${candidate.short}` : "empty"}
            </text>
            <text x="70" y="295" className="muted-text" fontSize="10">Eₜ와 일관된 첫 후보</text>
          </g>

          <path d="M228 232 H286" fill="none" stroke="var(--line-strong)" strokeWidth="2" markerEnd={`url(#${arrowId})`} />

          <g className="ogis-version-space">
            <rect x="302" y="130" width="294" height="224" rx="7" fill="var(--surface-subtle)" stroke="var(--line)" />
            <text x="322" y="158" className="muted-text mono" fontSize="9">VERSION SPACE Cₜ</text>
            {HYPOTHESES.map((hypothesis, index) => {
              const alive = survivors.some((survivor) => survivor.id === hypothesis.id);
              const active = candidate?.id === hypothesis.id;
              const x = 322 + (index % 2) * 132;
              const y = 177 + Math.floor(index / 2) * 39;
              return (
                <g key={hypothesis.id} opacity={alive ? 1 : 0.28}>
                  <rect
                    x={x}
                    y={y}
                    width="118"
                    height="29"
                    rx="5"
                    fill={active ? "var(--bg-attention-muted)" : "var(--bg-canvas)"}
                    stroke={active ? "var(--fg-attention)" : "var(--border-default)"}
                    strokeWidth="1.5"
                  />
                  <text x={x + 9} y={y + 19} className="mono" fontSize="9">
                    {hypothesis.id} · {hypothesis.label}
                  </text>
                  {!alive ? <path className="viz-edge" d={`M${x + 7} ${y + 7} L${x + 111} ${y + 22}`} stroke="var(--fg-danger)" strokeWidth="1.5" /> : null}
                </g>
              );
            })}
            <text x="322" y="337" className="muted-text mono" fontSize="9">Cₜ = &#123;h ∈ C | ∀(x,y)∈Eₜ, h(x)=y&#125;</text>
          </g>

          <path className="viz-edge" d="M596 232 H654" fill="none" stroke="var(--fg-attention)" strokeWidth="1.5" markerEnd={`url(#${attentionArrowId})`} />

          <g className="ogis-oracle">
            <rect className="viz-shape" x="670" y="155" width="182" height="154" rx="6" fill="var(--bg-attention-muted)" stroke="var(--fg-attention)" strokeWidth="1.5" />
            <text x="692" y="185" className="muted-text mono" fontSize="9">ORACLE INTERFACE</text>
            <text x="692" y="216" fontSize="15" fontWeight="760">{queryType}</text>
            <text x="692" y="244" className="muted-text" fontSize="10">target specification</text>
            <text x="692" y="266" className="mono" fontSize="11">
              {revealTarget ? "0 ≤ d ≤ subtotal" : "••••••••••••"}
            </text>
            <text x="692" y="293" className="muted-text" fontSize="10">query에 맞는 정보만 반환</text>
          </g>

          <path d="M760 309 C760 403 181 403 138 309" fill="none" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="6 6" markerEnd={`url(#${arrowId})`} />
          <rect className="viz-shape" x="266" y="382" width="370" height="54" rx="6" fill={accepted ? "var(--bg-success-muted)" : "var(--bg-canvas)"} stroke={accepted ? "var(--fg-success)" : "var(--border-emphasis)"} strokeWidth="1.5" />
          <text x="286" y="403" className="muted-text mono" fontSize="9">RESPONSE</text>
          <text x="286" y="424" className="mono" fontSize="10">{response}</text>
        </svg>
      </div>
    </LabShell>
  );
}
