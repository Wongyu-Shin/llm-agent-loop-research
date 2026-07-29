#!/usr/bin/env python3
"""Analyze paired contrasts for the M4b tiny empirical pilot."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path("data/M4b-agent-loop-necessity-tiny-pilot-results.json")
DEFAULT_OUTPUT = Path("data/M4b-agent-loop-necessity-tiny-pilot-analysis.json")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def binom_cdf(k: int, n: int, p: float = 0.5) -> float:
    return sum(math.comb(n, i) * (p**i) * ((1 - p) ** (n - i)) for i in range(k + 1))


def exact_mcnemar_p_value(b: int, c: int) -> float:
    discordant = b + c
    if discordant == 0:
        return 1.0
    lower_tail = binom_cdf(min(b, c), discordant, 0.5)
    return round(min(1.0, 2 * lower_tail), 6)


def paired_contrast(
    rows: list[dict[str, Any]],
    *,
    baseline: str,
    condition: str,
    task_class: str | None = None,
) -> dict[str, Any]:
    subset = [row for row in rows if task_class is None or row["task_class"] == task_class]
    by_task_condition = {
        (row["task_id"], row["condition_id"]): bool(row["passed"]) for row in subset
    }
    task_ids = sorted(
        {
            row["task_id"]
            for row in subset
            if (row["task_id"], baseline) in by_task_condition
            and (row["task_id"], condition) in by_task_condition
        }
    )
    both_pass = both_fail = baseline_only = condition_only = 0
    paired_rows = []
    for task_id in task_ids:
        base_pass = by_task_condition[(task_id, baseline)]
        condition_pass = by_task_condition[(task_id, condition)]
        if base_pass and condition_pass:
            both_pass += 1
        elif not base_pass and not condition_pass:
            both_fail += 1
        elif base_pass and not condition_pass:
            baseline_only += 1
        else:
            condition_only += 1
        paired_rows.append(
            {
                "task_id": task_id,
                "baseline_passed": base_pass,
                "condition_passed": condition_pass,
            }
        )
    n = len(task_ids)
    baseline_success = (both_pass + baseline_only) / n if n else 0.0
    condition_success = (both_pass + condition_only) / n if n else 0.0
    return {
        "condition": condition,
        "baseline": baseline,
        "task_class": task_class or "all",
        "n": n,
        "baseline_success_rate": round(baseline_success, 6),
        "condition_success_rate": round(condition_success, 6),
        "paired_success_delta": round(condition_success - baseline_success, 6),
        "both_pass": both_pass,
        "both_fail": both_fail,
        "baseline_only": baseline_only,
        "condition_only": condition_only,
        "discordant_pairs": baseline_only + condition_only,
        "exact_mcnemar_p_value": exact_mcnemar_p_value(baseline_only, condition_only),
        "paired_rows": paired_rows,
    }


def task_classes(rows: list[dict[str, Any]]) -> list[str]:
    return sorted({row["task_class"] for row in rows})


def build_payload(source: dict[str, Any]) -> dict[str, Any]:
    rows = source["results"]
    conditions = sorted({row["condition_id"] for row in rows if row["condition_id"] != "C0"})
    contrasts = []
    for condition in conditions:
        contrasts.append(paired_contrast(rows, baseline="C0", condition=condition))
        for task_class in task_classes(rows):
            contrasts.append(
                paired_contrast(
                    rows,
                    baseline="C0",
                    condition=condition,
                    task_class=task_class,
                )
            )
    return {
        "id": "M4b-agent-loop-necessity-tiny-pilot-analysis",
        "generated_at": utc_now(),
        "source_results": "data/M4b-agent-loop-necessity-tiny-pilot-results.json",
        "model": source.get("model"),
        "provider": source.get("provider"),
        "method": (
            "Paired task-level contrasts against C0 with an exact two-sided "
            "binomial McNemar-style p-value over discordant pairs. This is "
            "descriptive for the tiny pilot and not publication-grade inference."
        ),
        "contrasts": contrasts,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    root = repo_root()
    source = load_json(root / args.input)
    payload = build_payload(source)
    write_json(root / args.output, payload)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
