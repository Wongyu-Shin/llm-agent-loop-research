"use client";

import { StepForward } from "lucide-react";
import { useMemo, useState } from "react";
import { LabShell, RangeControl, ResetButton, SegmentedControl, useSvgIdPrefix } from "@/components/visualizations/viz-shell";

type ActionId = "unit" | "contract";
type ObservationId = "fail" | "pass";

const FAILURE_LIKELIHOOD: Record<ActionId, { validation: number; formula: number }> = {
  unit: { validation: 0.3, formula: 0.85 },
  contract: { validation: 0.92, formula: 0.35 },
};

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function PomdpBeliefLab() {
  const [beliefValidation, setBeliefValidation] = useState(0.5);
  const [action, setAction] = useState<ActionId>("contract");
  const [observation, setObservation] = useState<ObservationId>("fail");
  const [step, setStep] = useState(0);
  const svgPrefix = useSvgIdPrefix("pomdp-belief");
  const titleId = `${svgPrefix}-title`;
  const descriptionId = `${svgPrefix}-description`;
  const arrowId = `${svgPrefix}-arrow`;

  const calculation = useMemo(() => {
    const failure = FAILURE_LIKELIHOOD[action];
    const likelihoodValidation = observation === "fail" ? failure.validation : 1 - failure.validation;
    const likelihoodFormula = observation === "fail" ? failure.formula : 1 - failure.formula;
    const evidence =
      likelihoodValidation * beliefValidation +
      likelihoodFormula * (1 - beliefValidation);
    const posteriorValidation = evidence === 0
      ? beliefValidation
      : (likelihoodValidation * beliefValidation) / evidence;

    return {
      likelihoodValidation,
      likelihoodFormula,
      evidence,
      posteriorValidation,
      bayesFactor: likelihoodValidation / Math.max(1e-9, likelihoodFormula),
    };
  }, [action, beliefValidation, observation]);

  const recommended = calculation.posteriorValidation >= 0.5 ? "validator 추가" : "계산식 수정";
  const beliefFormula = 1 - beliefValidation;
  const posteriorFormula = 1 - calculation.posteriorValidation;

  function commitPosterior() {
    setBeliefValidation(calculation.posteriorValidation);
    setStep((current) => current + 1);
  }

  function reset() {
    setBeliefValidation(0.5);
    setAction("contract");
    setObservation("fail");
    setStep(0);
  }

  return (
    <LabShell
      title="테스트 결과에 따른 결함 가설 갱신"
      subtitle="선택한 test와 pass/fail이 입력 검증 누락과 계산식 결함의 posterior를 어떻게 바꾸는지 계산합니다."
      actions={
        <>
          <button className="lab-button primary" type="button" onClick={commitPosterior}>
            <StepForward aria-hidden="true" size={15} />
            Posterior 보존
          </button>
          <ResetButton onClick={reset} />
        </>
      }
      controls={
        <>
          <SegmentedControl<ActionId>
            label="Test action"
            value={action}
            options={[
              { value: "unit", label: "경계값 unit" },
              { value: "contract", label: "Contract" },
            ]}
            onChange={setAction}
          />
          <SegmentedControl<ObservationId>
            label="Observation"
            value={observation}
            options={[
              { value: "fail", label: "Fail" },
              { value: "pass", label: "Pass" },
            ]}
            onChange={setObservation}
          />
          <RangeControl
            id="pomdp-prior"
            label="Prior · validation 누락"
            value={beliefValidation}
            min={0.01}
            max={0.99}
            step={0.01}
            valueLabel={percent(beliefValidation)}
            onChange={setBeliefValidation}
          />
        </>
      }
      stageLabel="Illustrative likelihood model · Bayesian filter"
      legend={[
        { label: "입력 검증 누락", tone: "accent" },
        { label: "계산식 결함", tone: "attention" },
        { label: "관찰 경로", tone: "neutral" },
      ]}
      status={[
        { label: "Prior · validation", value: percent(beliefValidation) },
        { label: "Posterior · validation", value: percent(calculation.posteriorValidation) },
        { label: "Next patch", value: recommended },
      ]}
      explanation={
        <>
          <strong>Bayes factor {calculation.bayesFactor.toFixed(2)}</strong> · 선택한 test에서 이 observation이 validation 누락 가설을 formula 결함보다 얼마나 더 지지하는지 나타냅니다. 현재 step {step}. Posterior 보존을 반복할 때는 주어진 hidden cause 아래 관찰들이 조건부 독립이라는 교육용 가정을 사용하며, Next patch는 효용 최적화가 아닌 posterior 50% 기준의 진단 heuristic입니다.
        </>
      }
    >
      <div className="viz-scroll" tabIndex={0} aria-label="POMDP belief update 도식, 가로로 스크롤할 수 있습니다.">
        <svg className="viz-svg viz-wide pomdp-svg" viewBox="0 0 900 430" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>결제 API 결함 원인의 belief update</title>
          <desc id={descriptionId}>입력 검증 누락과 계산식 결함 가설의 prior가 선택한 test와 pass 또는 fail observation을 거쳐 posterior로 바뀝니다.</desc>
          <defs>
            <marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10Z" fill="var(--line-strong)" />
            </marker>
          </defs>

          <text x="60" y="42" className="muted-text mono" fontSize="11">PRIOR BELIEF</text>
          <text x="352" y="42" className="muted-text mono" fontSize="11">TEST + OBSERVATION</text>
          <text x="700" y="42" className="muted-text mono" fontSize="11">POSTERIOR</text>

          <g className="belief-prior">
            <rect className="viz-shape" x="60" y="82" width="164" height="104" rx="6" fill="var(--bg-accent-muted)" stroke="var(--fg-accent)" strokeWidth="1.5" />
            <text x="80" y="113" fontSize="12" fontWeight="700">입력 검증 누락</text>
            <text x="80" y="151" className="mono" fontSize="24" fill="var(--fg-accent)">{percent(beliefValidation)}</text>
            <rect className="viz-shape" x="60" y="244" width="164" height="104" rx="6" fill="var(--bg-attention-muted)" stroke="var(--fg-attention)" strokeWidth="1.5" />
            <text x="80" y="275" fontSize="12" fontWeight="700">계산식 결함</text>
            <text x="80" y="313" className="mono" fontSize="24" fill="var(--fg-attention)">{percent(beliefFormula)}</text>
          </g>

          <g className="observation-channel">
            <path className="viz-edge" d="M224 134 C288 134 292 183 350 183" fill="none" stroke="var(--fg-accent)" strokeOpacity=".72" strokeWidth={Math.max(2, beliefValidation * calculation.likelihoodValidation * 20)} />
            <path className="viz-edge" d="M224 296 C288 296 292 219 350 219" fill="none" stroke="var(--fg-attention)" strokeOpacity=".72" strokeWidth={Math.max(2, beliefFormula * calculation.likelihoodFormula * 20)} />
            <rect className="viz-shape" x="350" y="130" width="214" height="142" rx="6" fill="var(--bg-subtle)" stroke="var(--border-default)" strokeWidth="1.5" />
            <text x="370" y="158" className="muted-text mono" fontSize="10">ACTION</text>
            <text x="370" y="183" fontSize="14" fontWeight="700">{action === "contract" ? "Contract test" : "경계값 unit test"}</text>
            <line x1="370" y1="199" x2="544" y2="199" stroke="var(--border-muted)" />
            <text x="370" y="225" className="muted-text mono" fontSize="10">OBSERVATION</text>
            <text x="370" y="251" fontSize="14" fontWeight="700" fill={observation === "fail" ? "var(--fg-danger)" : "var(--fg-success)"}>{observation === "fail" ? "Fail" : "Pass"} · P(o) {calculation.evidence.toFixed(3)}</text>
          </g>

          <path className="viz-edge" d="M564 201 H642" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" markerEnd={`url(#${arrowId})`} />

          <g className="belief-posterior">
            <rect className="viz-shape" x="674" y="82" width="164" height="266" rx="6" fill="var(--bg-attention-muted)" stroke="var(--border-emphasis)" strokeWidth="1.5" />
            <rect x="674" y="82" width="164" height={266 * calculation.posteriorValidation} rx="6" fill="var(--bg-accent-muted)" />
            <line x1="674" y1={82 + 266 * calculation.posteriorValidation} x2="838" y2={82 + 266 * calculation.posteriorValidation} stroke="var(--border-emphasis)" />
            <text x="694" y="114" fontSize="11" fontWeight="700">입력 검증 누락</text>
            <text x="694" y="143" className="mono" fontSize="20" fill="var(--fg-accent)">{percent(calculation.posteriorValidation)}</text>
            <text x="694" y="303" fontSize="11" fontWeight="700">계산식 결함</text>
            <text x="694" y="332" className="mono" fontSize="20" fill="var(--fg-attention)">{percent(posteriorFormula)}</text>
          </g>

          <text x="450" y="395" textAnchor="middle" className="mono muted-text" fontSize="11">
            b′(s) = η · O(o|s,a) · b(s)  ·  diagnostic action uses identity transition
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
