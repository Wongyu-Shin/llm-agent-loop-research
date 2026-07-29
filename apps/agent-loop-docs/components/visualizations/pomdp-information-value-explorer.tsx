"use client";

import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  LabShell,
  RangeControl,
  ResetButton,
  SegmentedControl,
} from "@/components/visualizations/viz-shell";

type TestKind = "contract" | "boundary" | "smoke";
type PatchAction = "validator" | "formula";
type Observation = "fail" | "pass";

type TestDefinition = {
  label: string;
  shortLabel: string;
  diagnosticScale: number;
  failSupports: "validation" | "formula";
};

const PRIOR_VALIDATION = 0.58;
const PRIOR_FORMULA = 1 - PRIOR_VALIDATION;

const TESTS: Record<TestKind, TestDefinition> = {
  contract: {
    label: "Contract test",
    shortLabel: "Contract",
    diagnosticScale: 1,
    failSupports: "validation",
  },
  boundary: {
    label: "경계값 unit test",
    shortLabel: "경계값 unit",
    diagnosticScale: 0.8,
    failSupports: "formula",
  },
  smoke: {
    label: "Generic smoke test",
    shortLabel: "Smoke",
    diagnosticScale: 0.25,
    failSupports: "validation",
  },
};

const PATCHES: Record<
  PatchAction,
  {
    label: string;
    shortLabel: string;
    utilityValidation: number;
    utilityFormula: number;
  }
> = {
  validator: {
    label: "입력 validator 추가",
    shortLabel: "Validator patch",
    utilityValidation: 10,
    utilityFormula: -4,
  },
  formula: {
    label: "계산식 수정",
    shortLabel: "Formula patch",
    utilityValidation: -2,
    utilityFormula: 9,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function expectedUtility(action: PatchAction, beliefValidation: number) {
  const patch = PATCHES[action];
  return (
    beliefValidation * patch.utilityValidation +
    (1 - beliefValidation) * patch.utilityFormula
  );
}

function bestPatch(beliefValidation: number) {
  const validatorValue = expectedUtility("validator", beliefValidation);
  const formulaValue = expectedUtility("formula", beliefValidation);

  if (validatorValue >= formulaValue) {
    return {
      action: "validator" as const,
      value: validatorValue,
      alternativeValue: formulaValue,
    };
  }

  return {
    action: "formula" as const,
    value: formulaValue,
    alternativeValue: validatorValue,
  };
}

function format(value: number) {
  return value.toFixed(2);
}

function formatSigned(value: number) {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(2)}`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function selectWithKeyboard(event: KeyboardEvent<SVGGElement>, select: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}

export function PomdpInformationValueExplorer() {
  const uid = useId().replace(/:/g, "");
  const titleId = `pomdp-information-value-title-${uid}`;
  const descId = `pomdp-information-value-desc-${uid}`;
  const arrowId = `pomdp-information-value-arrow-${uid}`;
  const failArrowId = `pomdp-information-value-fail-arrow-${uid}`;
  const passArrowId = `pomdp-information-value-pass-arrow-${uid}`;

  const [testKind, setTestKind] = useState<TestKind>("contract");
  const [separation, setSeparation] = useState(0.55);
  const [cost, setCost] = useState(1);
  const [selectedObservation, setSelectedObservation] = useState<Observation>("pass");

  const calculation = useMemo(() => {
    const test = TESTS[testKind];
    const direction = test.failSupports === "validation" ? 1 : -1;
    const signedSeparation = direction * separation * test.diagnosticScale;
    const failGivenValidation = clamp(0.5 + signedSeparation / 2, 0.05, 0.95);
    const failGivenFormula = clamp(0.5 - signedSeparation / 2, 0.05, 0.95);
    const priorBest = bestPatch(PRIOR_VALIDATION);

    function makeBranch(observation: Observation) {
      const likelihoodValidation =
        observation === "fail" ? failGivenValidation : 1 - failGivenValidation;
      const likelihoodFormula =
        observation === "fail" ? failGivenFormula : 1 - failGivenFormula;
      const probability = clamp(
        PRIOR_VALIDATION * likelihoodValidation + PRIOR_FORMULA * likelihoodFormula,
        Number.EPSILON,
        1,
      );
      const beliefValidation = clamp(
        (PRIOR_VALIDATION * likelihoodValidation) / probability,
        0,
        1,
      );
      const best = bestPatch(beliefValidation);

      return {
        observation,
        probability,
        best,
        flips: best.action !== priorBest.action,
      };
    }

    const fail = makeBranch("fail");
    const pass = makeBranch("pass");
    const expectedAfter =
      fail.probability * fail.best.value + pass.probability * pass.best.value;
    const evsi = Math.max(0, expectedAfter - priorBest.value);

    return {
      test,
      failGivenValidation,
      failGivenFormula,
      priorBest,
      fail,
      pass,
      expectedAfter,
      evsi,
      netValue: evsi - cost,
    };
  }, [cost, separation, testKind]);

  const selectedBranch =
    selectedObservation === "fail" ? calculation.fail : calculation.pass;
  const flipCount = Number(calculation.fail.flips) + Number(calculation.pass.flips);

  function reset() {
    setTestKind("contract");
    setSeparation(0.55);
    setCost(1);
    setSelectedObservation("pass");
  }

  return (
    <LabShell
      title="테스트가 최적 patch를 바꾸는 정보 가치"
      subtitle="관찰 전 최적 action과 각 observation 뒤 최적 action을 비교해 EVSI와 test 비용을 계산합니다."
      actions={<ResetButton onClick={reset} />}
      controls={
        <>
          <SegmentedControl<TestKind>
            label="Test 종류"
            value={testKind}
            options={[
              { value: "contract", label: "Contract" },
              { value: "boundary", label: "경계값 unit" },
              { value: "smoke", label: "Smoke" },
            ]}
            onChange={(value) => {
              setTestKind(value);
              setSelectedObservation("pass");
            }}
          />
          <RangeControl
            id={`pomdp-information-separation-${uid}`}
            label="진단 분리도 d"
            value={separation}
            min={0}
            max={0.9}
            step={0.05}
            valueLabel={separation.toFixed(2)}
            onChange={setSeparation}
          />
          <RangeControl
            id={`pomdp-information-cost-${uid}`}
            label="Test 비용"
            value={cost}
            min={0}
            max={3}
            step={0.25}
            valueLabel={format(cost)}
            onChange={setCost}
          />
        </>
      }
      stageLabel="Illustrative utility model · observation before action"
      legend={[
        { label: "관찰 전 최적", tone: "accent" },
        { label: "action 유지", tone: "success" },
        { label: "action flip", tone: "attention" },
        { label: "선택 branch", tone: "neutral" },
      ]}
      status={[
        {
          label: "관찰 전 최적",
          value: `${PATCHES[calculation.priorBest.action].shortLabel} · EU ${format(calculation.priorBest.value)}`,
        },
        { label: "Action flip", value: `${flipCount} / 2 observation branches` },
        {
          label: "EVSI / Net VOI",
          value: `${formatSigned(calculation.evsi)} / ${formatSigned(calculation.netValue)}`,
        },
      ]}
      explanation={
        <>
          <strong>{selectedObservation === "fail" ? "Fail" : "Pass"} branch</strong>의 발생 확률은{" "}
          {percent(selectedBranch.probability)}이며, 최적 action은{" "}
          <strong>{PATCHES[selectedBranch.best.action].label}</strong>입니다. 관찰 전 action과 비교하면{" "}
          {selectedBranch.flips ? "선택이 뒤집힙니다." : "선택이 유지됩니다."} EVSI는 observation을 보기 전의
          기대 개선량이고, <strong>Net VOI(순정보가치) = EVSI − test cost</strong>입니다. Prior, likelihood,
          utility는 개념 확인용 illustrative assumption입니다.
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="테스트 observation 전후 최적 patch action과 정보 가치 도식, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className="viz-svg viz-wide pomdp-information-value-svg"
          viewBox="0 0 900 470"
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <title id={titleId}>테스트 observation이 최적 patch action을 바꾸는 기대 정보 가치</title>
          <desc id={descId}>
            관찰 전 최적 patch와 fail, pass observation 뒤 최적 patch를 비교하고, 선택한 test의 진단 분리도와
            비용으로 EVSI와 순정보가치를 계산합니다.
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
              id={failArrowId}
              data-branch-arrowhead="fail"
              viewBox="0 0 10 10"
              refX="0"
              refY="5"
              markerWidth="10"
              markerHeight="10"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-danger)" />
            </marker>
            <marker
              id={passArrowId}
              data-branch-arrowhead="pass"
              viewBox="0 0 10 10"
              refX="0"
              refY="5"
              markerWidth="10"
              markerHeight="10"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M0 0 10 5 0 10Z" fill="var(--fg-success)" />
            </marker>
          </defs>

          <rect className="viz-lane" x="42" y="24" width="816" height="55" rx="7" />
          <text className="viz-eyebrow" x="60" y="47">
            ILLUSTRATIVE ASSUMPTIONS
          </text>
          <text className="viz-body mono" x="60" y="66">
            P(validation)=.58 · P(formula)=.42 · correct patch utility 10/9 · mismatch -4/-2
          </text>

          <rect className="viz-node viz-node-accent" x="42" y="151" width="196" height="112" rx="7" />
          <text className="viz-eyebrow" x="62" y="178">
            BEFORE OBSERVATION
          </text>
          <text className="viz-title" x="62" y="208">
            {PATCHES[calculation.priorBest.action].label}
          </text>
          <text className="viz-value" x="62" y="236">
            max EU {format(calculation.priorBest.value)}
          </text>
          <text className="viz-body" x="62" y="253">
            prior만으로 고른 patch
          </text>

          <path
            className="viz-flow viz-flow-accent"
            d="M238 207 H286"
            markerEnd={`url(#${arrowId})`}
          />

          <rect className="viz-node viz-node-attention" x="302" y="133" width="220" height="148" rx="7" />
          <text className="viz-eyebrow" x="322" y="160">
            TEST · {calculation.test.shortLabel.toUpperCase()}
          </text>
          <text className="viz-title" x="322" y="188">
            {calculation.test.label}
          </text>
          <text className="viz-body mono" x="322" y="216">
            P(fail | validation) {calculation.failGivenValidation.toFixed(2)}
          </text>
          <text className="viz-body mono" x="322" y="238">
            P(fail | formula) {calculation.failGivenFormula.toFixed(2)}
          </text>
          <text className="viz-value" x="322" y="264">
            cost {format(cost)}
          </text>

          <path
            className="viz-flow viz-flow-danger"
            data-branch-flow="fail"
            d="M522 180 C548 180 548 141 570 141"
            markerEnd={`url(#${failArrowId})`}
          />
          <text className="viz-body mono" x="568" y="126" textAnchor="end">
            fail · p {calculation.fail.probability.toFixed(2)}
          </text>

          <path
            className="viz-flow viz-flow-success"
            data-branch-flow="pass"
            d="M522 232 C548 232 548 324 570 324"
            markerEnd={`url(#${passArrowId})`}
          />
          <text className="viz-body mono" x="542" y="287">
            pass · p {calculation.pass.probability.toFixed(2)}
          </text>

          {(
            [
              { branch: calculation.fail, y: 92, tone: "danger" },
              { branch: calculation.pass, y: 274, tone: "success" },
            ] as const
          ).map(({ branch, y, tone }) => {
            const isSelected = selectedObservation === branch.observation;
            const action = PATCHES[branch.best.action];
            return (
              <g
                key={branch.observation}
                className="viz-interactive"
                role="button"
                tabIndex={0}
                aria-label={`${branch.observation} observation, 확률 ${percent(branch.probability)}, 최적 action ${action.label}, ${branch.flips ? "action flip" : "action 유지"}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedObservation(branch.observation)}
                onKeyDown={(event) =>
                  selectWithKeyboard(event, () => setSelectedObservation(branch.observation))
                }
              >
                {isSelected ? (
                  <rect
                    className="viz-selection-halo"
                    x="576"
                    y={y - 4}
                    width="284"
                    height="128"
                    rx="10"
                    fill="none"
                    stroke="var(--fg-accent)"
                    strokeWidth="2"
                  />
                ) : null}
                <rect
                  className={`viz-node ${branch.flips ? "viz-node-attention" : `viz-node-${tone}`}`}
                  x="580"
                  y={y}
                  width="276"
                  height="120"
                  rx="7"
                />
                <text className="viz-eyebrow" x="600" y={y + 27}>
                  {branch.observation.toUpperCase()} OBSERVATION · P(o) {branch.probability.toFixed(2)}
                </text>
                <text className="viz-title" x="600" y={y + 58}>
                  {action.label}
                </text>
                <text className="viz-value" x="600" y={y + 84}>
                  max EU {format(branch.best.value)}
                </text>
                <rect
                  x="758"
                  y={y + 87}
                  width="78"
                  height="20"
                  rx="4"
                  fill={branch.flips ? "var(--bg-attention-muted)" : "var(--bg-success-muted)"}
                  stroke={branch.flips ? "var(--fg-attention)" : "var(--fg-success)"}
                />
                <text
                  className="mono"
                  x="797"
                  y={y + 101}
                  textAnchor="middle"
                  fontSize="9"
                  fill={branch.flips ? "var(--fg-attention)" : "var(--fg-success)"}
                >
                  {branch.flips ? "ACTION FLIP" : "KEEP"}
                </text>
              </g>
            );
          })}

          <rect
            className={`viz-node ${
              calculation.netValue > 0
                ? "viz-node-success"
                : calculation.netValue < 0
                  ? "viz-node-danger"
                  : "viz-node-attention"
            }`}
            x="42"
            y="412"
            width="816"
            height="44"
            rx="7"
          />
          <text className="viz-body mono" x="62" y="439">
            V_before {format(calculation.priorBest.value)} → Eₒ[V_after] {format(calculation.expectedAfter)}
          </text>
          <text className="viz-value" x="516" y="439">
            EVSI {formatSigned(calculation.evsi)}
          </text>
          <text
            className="viz-value"
            x="684"
            y="439"
            fill={
              calculation.netValue > 0
                ? "var(--fg-success)"
                : calculation.netValue < 0
                  ? "var(--fg-danger)"
                  : "var(--fg-attention)"
            }
          >
            Net VOI {formatSigned(calculation.netValue)}
          </text>
        </svg>
      </div>
    </LabShell>
  );
}
