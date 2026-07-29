#!/usr/bin/env python3
"""Deterministic math demos for the M4b agent-loop necessity argument."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT = Path("data/M4b-agent-loop-necessity-math-demo.json")


def binom_pmf(n: int, k: int, p: float) -> float:
    return math.comb(n, k) * (p**k) * ((1 - p) ** (n - k))


def greedy_counterexample() -> dict[str, Any]:
    paths = {
        "A C": 0.6 * 0.5,
        "B D": 0.4 * 1.0,
    }
    greedy_path = "A C"
    map_path = max(paths, key=paths.get)
    return {
        "description": "Token-level greedy can miss sequence-level MAP.",
        "first_step_probabilities": {"A": 0.6, "B": 0.4},
        "conditional_probabilities": {"C|A": 0.5, "D|B": 1.0},
        "sequence_probabilities": paths,
        "greedy_path": greedy_path,
        "sequence_map_path": map_path,
        "greedy_is_sequence_map": greedy_path == map_path,
    }


def hazard_curves() -> list[dict[str, Any]]:
    epsilons = [0.001, 0.005, 0.01, 0.05]
    horizons = [10, 100, 1_000, 10_000, 100_000]
    rows: list[dict[str, Any]] = []
    for epsilon in epsilons:
        row = {"epsilon": epsilon, "probability_any_failure": {}}
        for horizon in horizons:
            row["probability_any_failure"][str(horizon)] = 1 - ((1 - epsilon) ** horizon)
        rows.append(row)
    return rows


def best_of_n_curves() -> list[dict[str, Any]]:
    ps = [0.01, 0.05, 0.10, 0.25]
    ns = [1, 2, 4, 8, 16, 32, 64, 128]
    rows: list[dict[str, Any]] = []
    for p_success in ps:
        row = {"single_candidate_success": p_success, "best_of_n_success": {}}
        for n in ns:
            row["best_of_n_success"][str(n)] = 1 - ((1 - p_success) ** n)
        rows.append(row)
    return rows


def expected_selected_success(
    *,
    n: int,
    candidate_success_probability: float,
    true_positive_rate: float,
    false_positive_rate: float,
) -> float:
    """Exact expectation for a noisy pass/fail verifier.

    Selection rule:
    - Generate n candidates.
    - Verifier labels each success as pass with TPR and each failure as pass with FPR.
    - If any candidate passes, choose uniformly among passing candidates.
    - If no candidate passes, choose uniformly among all candidates.
    """

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


def verifier_quality_curves() -> list[dict[str, Any]]:
    configs = [
        {"label": "strong_verifier", "tpr": 0.95, "fpr": 0.05},
        {"label": "moderate_verifier", "tpr": 0.75, "fpr": 0.25},
        {"label": "weak_verifier", "tpr": 0.55, "fpr": 0.45},
        {"label": "adversarial_verifier", "tpr": 0.35, "fpr": 0.65},
    ]
    ns = [1, 2, 4, 8, 16, 32, 64]
    p = 0.10
    rows: list[dict[str, Any]] = []
    for config in configs:
        row = {
            "candidate_success_probability": p,
            "verifier": config,
            "selected_success_probability": {},
        }
        for n in ns:
            row["selected_success_probability"][str(n)] = expected_selected_success(
                n=n,
                candidate_success_probability=p,
                true_positive_rate=config["tpr"],
                false_positive_rate=config["fpr"],
            )
        rows.append(row)
    return rows


def cost_normalized_curve() -> dict[str, Any]:
    p = 0.05
    cost_per_candidate = 0.01
    ns = list(range(1, 129))
    points = []
    best = None
    for n in ns:
        success = 1 - ((1 - p) ** n)
        net_utility = success - (cost_per_candidate * n)
        point = {"n": n, "success": success, "net_utility": net_utility}
        points.append(point)
        if best is None or net_utility > best["net_utility"]:
            best = point
    return {
        "candidate_success_probability": p,
        "cost_per_candidate": cost_per_candidate,
        "best_n_by_net_utility": best,
        "selected_points": [points[i - 1] for i in [1, 2, 4, 8, 16, 32, 64, 128]],
    }


def build_payload() -> dict[str, Any]:
    return {
        "id": "M4b-agent-loop-necessity-math-demo",
        "date": "2026-05-27",
        "purpose": "Reproducible calculations supporting the mathematical appendix for the conditional loop-necessity thesis.",
        "demos": {
            "greedy_counterexample": greedy_counterexample(),
            "hazard_curves": hazard_curves(),
            "best_of_n_curves": best_of_n_curves(),
            "verifier_quality_curves": verifier_quality_curves(),
            "cost_normalized_curve": cost_normalized_curve(),
        },
        "interpretation": [
            "Token-level greedy can miss sequence-level MAP.",
            "Horizon-risk accumulation requires explicit nonzero hazard assumptions.",
            "Best-of-n improves oracle success with candidate count, but this assumes selection can identify success.",
            "Verifier quality determines whether repeated sampling helps, plateaus, or hurts.",
            "Costs create a finite optimum; unbounded looping is not justified."
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    payload = build_payload()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
