#!/usr/bin/env python3
"""Run the deterministic M4b loop-necessity pilot simulation.

This is a preflight for the analysis pipeline. It is not empirical evidence
about any real language model.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_MANIFEST = Path("data/M4b-agent-loop-necessity-pilot-manifest.json")
DEFAULT_OUTPUT = Path("data/M4b-agent-loop-necessity-pilot-results.json")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return min(max(value, lower), upper)


def binom_pmf(n: int, k: int, p: float) -> float:
    return math.comb(n, k) * (p**k) * ((1 - p) ** (n - k))


def expected_selected_success(
    *,
    n: int,
    candidate_success_probability: float,
    verifier: dict[str, Any],
) -> float:
    if verifier["selection"] == "random_candidate":
        return candidate_success_probability

    true_positive_rate = verifier["true_positive_rate"]
    false_positive_rate = verifier["false_positive_rate"]
    expected = 0.0
    for successes in range(n + 1):
        p_success_count = binom_pmf(n, successes, candidate_success_probability)
        failures = n - successes
        for true_passes in range(successes + 1):
            p_true_passes = binom_pmf(successes, true_passes, true_positive_rate)
            for false_passes in range(failures + 1):
                p_false_passes = binom_pmf(failures, false_passes, false_positive_rate)
                p_state = p_success_count * p_true_passes * p_false_passes
                passes = true_passes + false_passes
                if passes > 0:
                    selected_success = true_passes / passes
                else:
                    selected_success = successes / n
                expected += p_state * selected_success
    return expected


def cost_penalty(condition: dict[str, Any], cost_model: dict[str, float]) -> float:
    penalty = condition["model_calls"] * cost_model["model_call"]
    penalty += condition["tool_calls"] * cost_model["tool_call"]
    if condition["rollback_enabled"]:
        penalty += cost_model["rollback_enabled"]
    if condition["state_ledger"]:
        penalty += cost_model["state_ledger"]
    return penalty


def evaluate_cell(
    task_class: dict[str, Any],
    condition: dict[str, Any],
    verifiers: dict[str, dict[str, Any]],
    cost_model: dict[str, float],
) -> dict[str, Any]:
    p_candidate = clamp(
        task_class["base_candidate_success"] + condition["candidate_success_bonus"]
    )
    selected_success = expected_selected_success(
        n=condition["candidate_count"],
        candidate_success_probability=p_candidate,
        verifier=verifiers[condition["verifier"]],
    )
    adjusted_hazard = clamp(
        task_class["per_step_harmful_commitment_hazard"] * condition["hazard_multiplier"]
    )
    residual_failure_risk = 1 - ((1 - adjusted_hazard) ** task_class["horizon_steps"])
    expected_success = selected_success * (1 - residual_failure_risk)
    penalty = cost_penalty(condition, cost_model)
    utility = expected_success - penalty
    return {
        "task_class": task_class["id"],
        "condition_id": condition["id"],
        "condition_name": condition["name"],
        "candidate_success_probability": round(p_candidate, 6),
        "selected_success_before_horizon_risk": round(selected_success, 6),
        "residual_failure_risk": round(residual_failure_risk, 6),
        "expected_success_after_horizon_risk": round(expected_success, 6),
        "cost_penalty": round(penalty, 6),
        "expected_task_utility": round(utility, 6),
    }


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    by_task: dict[str, list[dict[str, Any]]] = {}
    for result in results:
        by_task.setdefault(result["task_class"], []).append(result)

    winners = {}
    contrasts = {}
    for task_class, rows in by_task.items():
        best = max(rows, key=lambda row: row["expected_task_utility"])
        winners[task_class] = {
            "condition_id": best["condition_id"],
            "condition_name": best["condition_name"],
            "expected_task_utility": best["expected_task_utility"],
        }
        lookup = {row["condition_id"]: row for row in rows}
        contrasts[task_class] = {
            "C6_minus_C0": round(
                lookup["C6"]["expected_task_utility"] - lookup["C0"]["expected_task_utility"],
                6,
            ),
            "C6_minus_C4": round(
                lookup["C6"]["expected_task_utility"] - lookup["C4"]["expected_task_utility"],
                6,
            ),
            "C3_minus_C2": round(
                lookup["C3"]["expected_task_utility"] - lookup["C2"]["expected_task_utility"],
                6,
            ),
            "C6_minus_C7": round(
                lookup["C6"]["expected_task_utility"] - lookup["C7"]["expected_task_utility"],
                6,
            ),
        }
    long_tasks = ["medium_reasoning", "long_software", "long_research", "long_planning"]
    checks = {
        "C6_improves_over_C0_on_all_long_tasks": all(
            contrasts[task]["C6_minus_C0"] > 0 for task in long_tasks
        ),
        "C6_does_not_improve_over_C0_on_short_task": contrasts["short_deterministic"]["C6_minus_C0"] <= 0,
        "C3_beats_C2_for_all_task_classes": all(
            contrast["C3_minus_C2"] > 0 for contrast in contrasts.values()
        ),
        "C6_beats_C7_for_all_task_classes": all(
            contrast["C6_minus_C7"] > 0 for contrast in contrasts.values()
        ),
        "C6_beats_C4_on_all_long_tasks": all(
            contrasts[task]["C6_minus_C4"] > 0 for task in long_tasks
        ),
    }
    return {
        "task_class_winners": winners,
        "predeclared_contrasts": contrasts,
        "predeclared_checks": checks,
        "all_predeclared_checks_passed": all(checks.values()),
    }


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_payload(manifest: dict[str, Any]) -> dict[str, Any]:
    results = [
        evaluate_cell(task_class, condition, manifest["verifiers"], manifest["cost_model"])
        for task_class in manifest["task_classes"]
        for condition in manifest["conditions"]
    ]
    return {
        "id": "M4b-agent-loop-necessity-pilot-results",
        "generated_at": utc_now(),
        "source_manifest": "data/M4b-agent-loop-necessity-pilot-manifest.json",
        "claim_boundary": manifest["claim_boundary"],
        "utility_formula": manifest["utility_formula"],
        "results": results,
        "summary": summarize(results),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    root = repo_root()
    manifest = load_manifest(root / args.manifest)
    payload = build_payload(manifest)
    output_path = root / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
