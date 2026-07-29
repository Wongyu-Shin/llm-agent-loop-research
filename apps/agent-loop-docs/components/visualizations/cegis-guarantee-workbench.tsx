"use client";

import { useId, useState } from "react";
import { LabShell, ResetButton, SegmentedControl } from "@/components/visualizations/viz-shell";

type BinaryChoice = "yes" | "no";
type DomainMode = "finite" | "unbounded";
type MemoryMode = "retain" | "drop";
type CandidateMode = "finite" | "infinite";
type GuaranteeLevel = "guaranteed" | "conditional" | "not-guaranteed";

type AssumptionCardProps = {
  x: number;
  eyebrow: string;
  value: string;
  detail: string;
  favorable: boolean;
  onToggle: () => void;
};

type GuaranteeCard = {
  title: string;
  level: GuaranteeLevel;
  value: string;
  detail: string;
};

const BINARY_OPTIONS: Array<{ value: BinaryChoice; label: string }> = [
  { value: "yes", label: "예" },
  { value: "no", label: "아니오" },
];

function levelClass(level: GuaranteeLevel) {
  if (level === "guaranteed") return "viz-node-success";
  if (level === "conditional") return "viz-node-attention";
  return "viz-node-danger";
}

function levelLabel(level: GuaranteeLevel) {
  if (level === "guaranteed") return "GUARANTEED";
  if (level === "conditional") return "CONDITIONAL";
  return "NOT GUARANTEED";
}

function AssumptionCard({
  x,
  eyebrow,
  value,
  detail,
  favorable,
  onToggle,
}: AssumptionCardProps) {
  function handleKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  }

  return (
    <g
      className="viz-interactive"
      role="button"
      tabIndex={0}
      aria-label={`${eyebrow}: ${value}. 상태 전환`}
      aria-pressed={favorable}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <rect
        className={`viz-node ${favorable ? "viz-node-success" : "viz-node-attention"}`}
        x={x}
        y="62"
        width="148"
        height="94"
        rx="8"
      />
      <text className="viz-eyebrow" x={x + 14} y="88">{eyebrow}</text>
      <text className="viz-title" x={x + 14} y="116">{value}</text>
      <text className="viz-body" x={x + 14} y="140">{detail}</text>
    </g>
  );
}

export function CegisGuaranteeWorkbench() {
  const instanceId = useId().replace(/:/g, "");
  const titleId = `${instanceId}-cegis-guarantee-title`;
  const descId = `${instanceId}-cegis-guarantee-desc`;
  const arrowId = `${instanceId}-cegis-guarantee-arrow`;

  const [domainMode, setDomainMode] = useState<DomainMode>("finite");
  const [verifierSound, setVerifierSound] = useState<BinaryChoice>("yes");
  const [verifierComplete, setVerifierComplete] = useState<BinaryChoice>("no");
  const [memoryMode, setMemoryMode] = useState<MemoryMode>("retain");
  const [candidateMode, setCandidateMode] = useState<CandidateMode>("finite");

  const sound = verifierSound === "yes";
  const complete = verifierComplete === "yes";
  const retainsCounterexamples = memoryMode === "retain";
  const finiteCandidates = candidateMode === "finite";
  const terminationConditions =
    sound && complete && retainsCounterexamples && finiteCandidates;
  const acceptCanProveDomain = sound && complete;

  const guaranteeCards: GuaranteeCard[] = [
    {
      title: "Evidence consistency",
      level: sound ? "guaranteed" : "not-guaranteed",
      value: sound ? "반례가 specification과 일치" : "잘못된 반례가 valid 후보를 제거 가능",
      detail: sound ? "sound counterexample만 Eₜ에 추가" : "oracle soundness가 필요",
    },
    {
      title: "Monotonic elimination",
      level: retainsCounterexamples ? "guaranteed" : "not-guaranteed",
      value: retainsCounterexamples ? "Cₜ₊₁ ⊆ Cₜ" : "이전 실패 후보가 복귀 가능",
      detail: retainsCounterexamples
        ? sound
          ? "누적 Eₜ를 모두 강제해 version space를 비증가시킴"
          : "집합은 줄지만 거짓 반례가 valid 후보를 제거할 수 있음"
        : "Eₜ를 덮어쓰면 단조성 소실",
    },
    {
      title: "Termination",
      level: terminationConditions ? "conditional" : "not-guaranteed",
      value: terminationConditions ? "valid candidate가 존재할 때 조건부" : "현재 전제로는 종료 보장 없음",
      detail: terminationConditions
        ? "finite C + sound/complete verifier + retained CE"
        : "finite candidate, complete verifier, retention 필요",
    },
    {
      title: "Universal correctness",
      level: acceptCanProveDomain ? "conditional" : "not-guaranteed",
      value: acceptCanProveDomain ? "Verifier ACCEPT에 한해서만" : "finite suite accept로는 증명 불가",
      detail: acceptCanProveDomain
        ? domainMode === "finite"
          ? "선언한 finite D 전체를 검증한 ACCEPT"
          : "unbounded D를 다루는 proof verifier의 ACCEPT"
        : "sound + complete verification이 필요",
    },
  ];

  function reset() {
    setDomainMode("finite");
    setVerifierSound("yes");
    setVerifierComplete("no");
    setMemoryMode("retain");
    setCandidateMode("finite");
  }

  const universalStatus = acceptCanProveDomain
    ? "ACCEPT + verifier 가정에 한함"
    : "증명 불가";

  return (
    <LabShell
      title="CEGIS 보장을 성립시키는 전제 분해"
      subtitle="Domain, verifier, counterexample memory, candidate space를 바꾸며 consistency, 단조성, 종료, correctness를 따로 판정합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <>
          <SegmentedControl<DomainMode>
            label="Input domain"
            value={domainMode}
            options={[
              { value: "finite", label: "Finite 전체" },
              { value: "unbounded", label: "Unbounded" },
            ]}
            onChange={setDomainMode}
          />
          <SegmentedControl<BinaryChoice>
            label="Verifier sound"
            value={verifierSound}
            options={BINARY_OPTIONS}
            onChange={setVerifierSound}
          />
          <SegmentedControl<BinaryChoice>
            label="Verifier complete"
            value={verifierComplete}
            options={BINARY_OPTIONS}
            onChange={setVerifierComplete}
          />
          <SegmentedControl<MemoryMode>
            label="Counterexample memory"
            value={memoryMode}
            options={[
              { value: "retain", label: "모두 보존" },
              { value: "drop", label: "덮어쓰기" },
            ]}
            onChange={setMemoryMode}
          />
          <SegmentedControl<CandidateMode>
            label="Candidate space"
            value={candidateMode}
            options={[
              { value: "finite", label: "Finite" },
              { value: "infinite", label: "Infinite" },
            ]}
            onChange={setCandidateMode}
          />
        </>
      }
      stageLabel="Guarantee assumption workbench"
      legend={[
        { label: "보장", tone: "success" },
        { label: "조건부", tone: "attention" },
        { label: "보장 없음", tone: "danger" },
      ]}
      status={[
        {
          label: "Evidence consistency",
          value: sound ? "sound counterexample" : "보장 없음",
        },
        {
          label: "Candidate progress",
          value: retainsCounterexamples ? "Cₜ₊₁ ⊆ Cₜ" : "단조성 깨짐",
        },
        { label: "Universal correctness", value: universalStatus },
      ]}
      explanation={
        <>
          <strong>Finite test suite의 accept는 universal proof가 아닙니다.</strong>{" "}
          {acceptCanProveDomain
            ? domainMode === "finite"
              ? "선언한 finite domain 전체를 sound하고 complete하게 검증한 ACCEPT만 그 domain에 대한 correctness를 지지합니다."
              : "Unbounded domain에서는 sound하고 complete한 proof verifier의 ACCEPT가 필요합니다."
            : "현재 설정에서는 verifier의 ACCEPT도 모든 x ∈ D에 대한 correctness를 보장하지 못합니다."}
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="CEGIS 보장 전제와 보장 수준을 보여주는 도식, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className="viz-svg viz-wide cegis-guarantee-svg"
          viewBox="0 0 900 480"
          role="group"
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>CEGIS 보장 전제 workbench</title>
          <desc id={descId}>
            Domain, verifier soundness와 completeness, counterexample retention, candidate space를 조작해
            evidence consistency, monotonic elimination, termination, universal correctness의 보장 수준을
            비교합니다. Finite test suite 통과는 universal proof가 아닙니다.
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
          </defs>

          <text className="viz-eyebrow" x="38" y="40">ASSUMPTIONS · CLICK EACH CARD TO CHANGE THE MODEL</text>

          <AssumptionCard
            x={38}
            eyebrow="DOMAIN D"
            value={domainMode === "finite" ? "finite 전체" : "unbounded"}
            detail={domainMode === "finite" ? "exhaustive 가능" : "proof 필요"}
            favorable={domainMode === "finite"}
            onToggle={() => setDomainMode(domainMode === "finite" ? "unbounded" : "finite")}
          />
          <AssumptionCard
            x={202}
            eyebrow="VERIFIER"
            value={sound ? "sound" : "not sound"}
            detail={sound ? "반례가 참" : "거짓 반례 가능"}
            favorable={sound}
            onToggle={() => setVerifierSound(sound ? "no" : "yes")}
          />
          <AssumptionCard
            x={366}
            eyebrow="VERIFIER"
            value={complete ? "complete" : "incomplete"}
            detail={complete ? "위반을 모두 탐지" : "위반 누락 가능"}
            favorable={complete}
            onToggle={() => setVerifierComplete(complete ? "no" : "yes")}
          />
          <AssumptionCard
            x={530}
            eyebrow="CE MEMORY"
            value={retainsCounterexamples ? "retain all" : "drop old"}
            detail={retainsCounterexamples ? "Eₜ ⊆ Eₜ₊₁" : "evidence 덮어씀"}
            favorable={retainsCounterexamples}
            onToggle={() => setMemoryMode(retainsCounterexamples ? "drop" : "retain")}
          />
          <AssumptionCard
            x={694}
            eyebrow="CANDIDATES C"
            value={finiteCandidates ? "finite" : "infinite"}
            detail={finiteCandidates ? "제거로 소진" : "무한 진행 가능"}
            favorable={finiteCandidates}
            onToggle={() => setCandidateMode(finiteCandidates ? "infinite" : "finite")}
          />

          {[112, 276, 440, 604, 768].map((x) => (
            <path key={x} className="viz-flow" d={`M${x} 156 V181`} />
          ))}
          <path className="viz-flow" d="M112 181 H768" />
          <path
            className="viz-flow"
            d="M450 181 V201"
            markerEnd={`url(#${arrowId})`}
          />

          <text className="viz-eyebrow" x="38" y="207">GUARANTEE LEDGER · EACH CLAIM HAS DIFFERENT PRECONDITIONS</text>

          {guaranteeCards.map((item, index) => {
            const x = index % 2 === 0 ? 38 : 462;
            const y = index < 2 ? 224 : 326;
            return (
              <g key={item.title}>
                <rect
                  className={`viz-node ${levelClass(item.level)}`}
                  x={x}
                  y={y}
                  width="400"
                  height="88"
                  rx="8"
                />
                <text className="viz-eyebrow" x={x + 18} y={y + 25}>{item.title}</text>
                <text
                  className="viz-value"
                  x={x + 382}
                  y={y + 25}
                  textAnchor="end"
                >
                  {levelLabel(item.level)}
                </text>
                <text className="viz-title" x={x + 18} y={y + 52}>{item.value}</text>
                <text className="viz-body" x={x + 18} y={y + 74}>{item.detail}</text>
              </g>
            );
          })}

          <rect
            className="viz-node viz-node-danger"
            x="130"
            y="438"
            width="640"
            height="30"
            rx="6"
          />
          <text className="viz-value" x="450" y="458" textAnchor="middle">
            NON-EXHAUSTIVE TEST ACCEPT ≠ ∀x∈D CORRECT
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
