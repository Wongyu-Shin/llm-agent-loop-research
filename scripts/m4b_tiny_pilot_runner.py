#!/usr/bin/env python3
"""Run or preflight the M4b tiny empirical loop pilot.

Modes:
  provider-check: inspect provider configuration and model availability.
  dry-run: validate the runner with deterministic fixture answers.
  run: call an OpenAI-compatible /v1/chat/completions provider.

Only mode=run with a real provider is empirical LLM evidence.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_MANIFEST = Path("data/M4b-agent-loop-necessity-tiny-pilot-manifest.json")
DEFAULT_PROVIDER_CHECK_OUTPUT = Path(
    "data/M4b-agent-loop-necessity-tiny-pilot-provider-check.json"
)
DEFAULT_DRY_RUN_OUTPUT = Path("data/M4b-agent-loop-necessity-tiny-pilot-dry-run.json")
DEFAULT_RUN_OUTPUT = Path("data/M4b-agent-loop-necessity-tiny-pilot-results.json")

MODEL_PREFERENCES = [
    "gpt-5.4-mini",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.2",
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-4o-mini",
    "gpt-4o",
]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def api_v1_base(raw_base: str) -> str:
    base = raw_base.rstrip("/")
    return base if base.endswith("/v1") else f"{base}/v1"


def request_json(
    *,
    method: str,
    url: str,
    api_key: str,
    body: dict[str, Any] | None = None,
    timeout_seconds: int = 60,
) -> dict[str, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} from {url}: {detail[:800]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Provider request failed for {url}: {error}") from error


def list_models(api_base: str, api_key: str, timeout_seconds: int) -> list[str]:
    payload = request_json(
        method="GET",
        url=f"{api_v1_base(api_base)}/models",
        api_key=api_key,
        timeout_seconds=timeout_seconds,
    )
    return sorted(
        item["id"]
        for item in payload.get("data", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    )


def looks_chat_capable(model_id: str) -> bool:
    lowered = model_id.lower()
    if not lowered.startswith(("gpt-", "o")):
        return False
    blocked = [
        "audio",
        "embedding",
        "image",
        "moderation",
        "realtime",
        "search",
        "speech",
        "transcribe",
        "tts",
        "whisper",
    ]
    return not any(token in lowered for token in blocked)


def choose_model(models: list[str]) -> str | None:
    available = set(models)
    for candidate in MODEL_PREFERENCES:
        if candidate in available:
            return candidate
    chat_like = [model for model in models if looks_chat_capable(model)]
    return chat_like[0] if chat_like else None


def extract_answer(text: str) -> str:
    cleaned = text.strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "answer" in parsed:
            return str(parsed["answer"]).strip()
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*?\}", cleaned, flags=re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict) and "answer" in parsed:
                return str(parsed["answer"]).strip()
        except json.JSONDecodeError:
            pass
    return cleaned.strip().strip('"').strip()


def normalize_answer(value: str, case_sensitive: bool = False) -> str:
    normalized = re.sub(r"\s+", " ", value.strip())
    return normalized if case_sensitive else normalized.lower()


def strong_verify(task: dict[str, Any], text: str) -> dict[str, Any]:
    answer = extract_answer(text)
    case_sensitive = bool(task.get("case_sensitive", False))
    expected = [normalize_answer(str(item), case_sensitive) for item in task["expected"]]
    observed = normalize_answer(answer, case_sensitive)
    return {
        "passed": observed in expected,
        "answer": answer,
        "observed_normalized": observed,
        "expected_normalized": expected,
        "reason": "exact_match" if observed in expected else "exact_match_failed",
    }


def weak_verify(text: str) -> dict[str, Any]:
    answer = extract_answer(text)
    passed = bool(answer) and len(answer) <= 200
    return {
        "passed": passed,
        "answer": answer,
        "reason": "nonempty_short_answer" if passed else "answer_shape_failed",
    }


def condition_temperature(condition_id: str, sampling_temperature: float | None) -> float | None:
    if condition_id in {"C3", "C7"}:
        return sampling_temperature
    return 0.0 if sampling_temperature is not None else None


def task_prompt(manifest: dict[str, Any], task: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are participating in a deterministic benchmark. "
                f"{manifest['answer_contract']['format']} "
                "Do not include explanations, markdown, or extra keys."
            ),
        },
        {
            "role": "user",
            "content": f"TASK_ID: {task['id']}\nTask: {task['prompt']}",
        },
    ]


def revision_prompt(
    manifest: dict[str, Any],
    task: dict[str, Any],
    prior_answer: str,
    verifier_feedback: str | None,
) -> list[dict[str, str]]:
    feedback = (
        "No external verifier result is available. Critique your own answer and revise if needed."
        if verifier_feedback is None
        else verifier_feedback
    )
    return [
        {
            "role": "system",
            "content": (
                "You are participating in a deterministic benchmark. "
                f"{manifest['answer_contract']['format']} "
                "Do not include explanations, markdown, or extra keys."
            ),
        },
        {
            "role": "user",
            "content": (
                f"TASK_ID: {task['id']}\n"
                f"Task: {task['prompt']}\n"
                f"Prior answer: {prior_answer}\n"
                f"Feedback: {feedback}\n"
                "Return the revised final answer."
            ),
        },
    ]


@dataclass
class ChatResult:
    text: str
    usage: dict[str, Any]
    latency_seconds: float
    provider: str
    model: str


class DryRunProvider:
    def __init__(self, manifest: dict[str, Any]) -> None:
        self.manifest = manifest
        self.positions: dict[str, int] = {}

    def chat(
        self,
        *,
        messages: list[dict[str, str]],
        condition_id: str,
        task: dict[str, Any],
        temperature: float | None,
        timeout_seconds: int,
    ) -> ChatResult:
        del messages, temperature, timeout_seconds
        task_id = task["id"]
        position_key = f"{task_id}::{condition_id}"
        answers = task["dry_run_answers"]
        index = self.positions.get(position_key, 0)
        self.positions[position_key] = index + 1
        answer = answers[min(index, len(answers) - 1)]
        return ChatResult(
            text=json.dumps({"answer": answer}, separators=(",", ":")),
            usage={"fixture_call_index": index},
            latency_seconds=0.0,
            provider="dry-run-fixture",
            model="fixture",
        )


class OpenAICompatibleProvider:
    def __init__(self, *, api_base: str, api_key: str, model: str) -> None:
        self.api_base = api_base
        self.api_key = api_key
        self.model = model

    def chat(
        self,
        *,
        messages: list[dict[str, str]],
        condition_id: str,
        task: dict[str, Any],
        temperature: float | None,
        timeout_seconds: int,
    ) -> ChatResult:
        del condition_id, task
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
        }
        if temperature is not None:
            body["temperature"] = temperature
        start = time.time()
        try:
            payload = request_json(
                method="POST",
                url=f"{api_v1_base(self.api_base)}/chat/completions",
                api_key=self.api_key,
                body=body,
                timeout_seconds=timeout_seconds,
            )
        except RuntimeError as error:
            message = str(error).lower()
            if "temperature" not in message:
                raise
            body.pop("temperature", None)
            payload = request_json(
                method="POST",
                url=f"{api_v1_base(self.api_base)}/chat/completions",
                api_key=self.api_key,
                body=body,
                timeout_seconds=timeout_seconds,
            )
        latency = time.time() - start
        choices = payload.get("choices") or []
        if not choices:
            raise RuntimeError(f"Provider returned no choices: {json.dumps(payload)[:800]}")
        message = choices[0].get("message") or {}
        return ChatResult(
            text=str(message.get("content") or ""),
            usage=payload.get("usage") or {},
            latency_seconds=round(latency, 3),
            provider=self.api_base,
            model=str(payload.get("model") or self.model),
        )


def candidate_record(
    *,
    call_index: int,
    chat: ChatResult,
    task: dict[str, Any],
    selected_by: str,
    temperature: float | None,
) -> dict[str, Any]:
    strong = strong_verify(task, chat.text)
    weak = weak_verify(chat.text)
    return {
        "call_index": call_index,
        "raw_text": chat.text,
        "answer": strong["answer"],
        "strong_verifier": strong,
        "weak_verifier": weak,
        "selected_by": selected_by,
        "temperature": temperature,
        "usage": chat.usage,
        "latency_seconds": chat.latency_seconds,
        "provider": chat.provider,
        "model": chat.model,
    }


def run_condition(
    *,
    manifest: dict[str, Any],
    provider: DryRunProvider | OpenAICompatibleProvider,
    task: dict[str, Any],
    condition: dict[str, Any],
    temperature: float | None,
    timeout_seconds: int,
) -> dict[str, Any]:
    condition_id = condition["id"]
    call_temperature = condition_temperature(condition_id, temperature)
    candidates: list[dict[str, Any]] = []

    if condition_id == "C0":
        chat = provider.chat(
            messages=task_prompt(manifest, task),
            condition_id=condition_id,
            task=task,
            temperature=call_temperature,
            timeout_seconds=timeout_seconds,
        )
        candidates.append(
            candidate_record(
                call_index=1,
                chat=chat,
                task=task,
                selected_by="single",
                temperature=call_temperature,
            )
        )
        selected = candidates[0]

    elif condition_id == "C3":
        for call_index in range(1, condition["candidate_count"] + 1):
            chat = provider.chat(
                messages=task_prompt(manifest, task),
                condition_id=condition_id,
                task=task,
                temperature=call_temperature,
                timeout_seconds=timeout_seconds,
            )
            candidates.append(
                candidate_record(
                    call_index=call_index,
                    chat=chat,
                    task=task,
                    selected_by="strong_verifier",
                    temperature=call_temperature,
                )
            )
        selected = next(
            (item for item in candidates if item["strong_verifier"]["passed"]),
            candidates[0],
        )

    elif condition_id == "C4":
        first = provider.chat(
            messages=task_prompt(manifest, task),
            condition_id=condition_id,
            task=task,
            temperature=call_temperature,
            timeout_seconds=timeout_seconds,
        )
        first_record = candidate_record(
            call_index=1,
            chat=first,
            task=task,
            selected_by="self_revision_seed",
            temperature=call_temperature,
        )
        candidates.append(first_record)
        second = provider.chat(
            messages=revision_prompt(
                manifest=manifest,
                task=task,
                prior_answer=first_record["answer"],
                verifier_feedback=None,
            ),
            condition_id=condition_id,
            task=task,
            temperature=call_temperature,
            timeout_seconds=timeout_seconds,
        )
        candidates.append(
            candidate_record(
                call_index=2,
                chat=second,
                task=task,
                selected_by="self_revision_final",
                temperature=call_temperature,
            )
        )
        selected = candidates[-1]

    elif condition_id == "C6":
        selected = None
        prior_answer = ""
        for call_index in range(1, condition["max_iterations"] + 1):
            messages = (
                task_prompt(manifest, task)
                if call_index == 1
                else revision_prompt(
                    manifest=manifest,
                    task=task,
                    prior_answer=prior_answer,
                    verifier_feedback=(
                        "The deterministic verifier rejected the prior answer. "
                        "Revise the answer. The correct answer is not provided."
                    ),
                )
            )
            chat = provider.chat(
                messages=messages,
                condition_id=condition_id,
                task=task,
                temperature=call_temperature,
                timeout_seconds=timeout_seconds,
            )
            record = candidate_record(
                call_index=call_index,
                chat=chat,
                task=task,
                selected_by="strong_verifier_feedback",
                temperature=call_temperature,
            )
            candidates.append(record)
            prior_answer = record["answer"]
            selected = record
            if record["strong_verifier"]["passed"]:
                break
        assert selected is not None

    elif condition_id == "C7":
        for call_index in range(1, condition["candidate_count"] + 1):
            chat = provider.chat(
                messages=task_prompt(manifest, task),
                condition_id=condition_id,
                task=task,
                temperature=call_temperature,
                timeout_seconds=timeout_seconds,
            )
            candidates.append(
                candidate_record(
                    call_index=call_index,
                    chat=chat,
                    task=task,
                    selected_by="weak_verifier",
                    temperature=call_temperature,
                )
            )
        selected = next(
            (item for item in candidates if item["weak_verifier"]["passed"]),
            candidates[0],
        )

    else:
        raise ValueError(f"Unsupported condition: {condition_id}")

    return {
        "task_id": task["id"],
        "task_class": task["class"],
        "condition_id": condition_id,
        "condition_name": condition["name"],
        "selected_answer": selected["answer"],
        "passed": selected["strong_verifier"]["passed"],
        "selected_call_index": selected["call_index"],
        "model_calls": len(candidates),
        "candidates": candidates,
    }


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    by_condition: dict[str, list[dict[str, Any]]] = {}
    by_condition_class: dict[str, list[dict[str, Any]]] = {}
    for row in results:
        by_condition.setdefault(row["condition_id"], []).append(row)
        key = f"{row['condition_id']}::{row['task_class']}"
        by_condition_class.setdefault(key, []).append(row)

    def rate(rows: list[dict[str, Any]]) -> float:
        return round(sum(1 for row in rows if row["passed"]) / len(rows), 6) if rows else 0.0

    condition_summary = {
        condition: {
            "n": len(rows),
            "success_rate": rate(rows),
            "total_model_calls": sum(row["model_calls"] for row in rows),
        }
        for condition, rows in sorted(by_condition.items())
    }
    class_summary = {
        key: {
            "n": len(rows),
            "success_rate": rate(rows),
            "total_model_calls": sum(row["model_calls"] for row in rows),
        }
        for key, rows in sorted(by_condition_class.items())
    }

    def contrast(condition_a: str, condition_b: str, task_class: str | None = None) -> float | None:
        def rows_for(condition: str) -> list[dict[str, Any]]:
            rows = by_condition.get(condition, [])
            if task_class is not None:
                rows = [row for row in rows if row["task_class"] == task_class]
            return rows

        rows_a = rows_for(condition_a)
        rows_b = rows_for(condition_b)
        if not rows_a or not rows_b:
            return None
        return round(rate(rows_a) - rate(rows_b), 6)

    contrasts = {
        "C6_minus_C0_all": contrast("C6", "C0"),
        "C3_minus_C0_all": contrast("C3", "C0"),
        "C4_minus_C0_all": contrast("C4", "C0"),
        "C7_minus_C0_all": contrast("C7", "C0"),
        "C6_minus_C0_medium_reasoning": contrast("C6", "C0", "medium_reasoning"),
        "C6_minus_C0_tiny_symbolic": contrast("C6", "C0", "tiny_symbolic"),
        "C6_minus_C0_stress_deterministic": contrast(
            "C6", "C0", "stress_deterministic"
        ),
        "C3_minus_C0_nonshort": None,
    }

    nonshort_c3 = [
        row for row in by_condition.get("C3", []) if row["task_class"] != "short_deterministic"
    ]
    nonshort_c0 = [
        row for row in by_condition.get("C0", []) if row["task_class"] != "short_deterministic"
    ]
    if nonshort_c3 and nonshort_c0:
        contrasts["C3_minus_C0_nonshort"] = round(rate(nonshort_c3) - rate(nonshort_c0), 6)

    return {
        "by_condition": condition_summary,
        "by_condition_and_task_class": class_summary,
        "predeclared_contrasts": contrasts,
    }


def selected_conditions(
    manifest: dict[str, Any],
    requested: str,
) -> list[dict[str, Any]]:
    wanted = [item.strip() for item in requested.split(",") if item.strip()]
    if not wanted:
        return manifest["conditions"]
    lookup = {condition["id"]: condition for condition in manifest["conditions"]}
    missing = [condition for condition in wanted if condition not in lookup]
    if missing:
        raise ValueError(f"Unknown condition(s): {', '.join(missing)}")
    return [lookup[condition] for condition in wanted]


def selected_tasks(manifest: dict[str, Any], requested: str, limit: int | None) -> list[dict[str, Any]]:
    tasks = manifest["tasks"]
    wanted = [item.strip() for item in requested.split(",") if item.strip()]
    if wanted:
        lookup = {task["id"]: task for task in tasks}
        missing = [task for task in wanted if task not in lookup]
        if missing:
            raise ValueError(f"Unknown task(s): {', '.join(missing)}")
        tasks = [lookup[task] for task in wanted]
    if limit is not None:
        tasks = tasks[:limit]
    return tasks


def provider_check(args: argparse.Namespace) -> dict[str, Any]:
    api_base = args.api_base or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com"
    api_key = args.api_key or os.environ.get("OPENAI_API_KEY") or ""
    env_model = args.model or os.environ.get("OPENAI_MODEL") or ""
    payload: dict[str, Any] = {
        "id": "M4b-agent-loop-necessity-tiny-pilot-provider-check",
        "generated_at": utc_now(),
        "api_base": api_base,
        "api_key_present": bool(api_key),
        "model_from_config": env_model or None,
        "mode": "provider-check",
    }
    if not api_key and not api_base.startswith(("http://127.0.0.1", "http://localhost")):
        payload.update(
            {
                "ok": False,
                "reason": "OPENAI_API_KEY is missing for a non-local provider.",
                "available_model_count": 0,
                "selected_model": None,
            }
        )
        return payload

    try:
        models = list_models(api_base, api_key, args.timeout_seconds)
        selected = env_model or choose_model(models)
        payload.update(
            {
                "ok": bool(selected),
                "available_model_count": len(models),
                "selected_model": selected,
                "chat_like_model_sample": [model for model in models if looks_chat_capable(model)][:20],
            }
        )
    except Exception as error:  # noqa: BLE001
        payload.update(
            {
                "ok": False,
                "reason": str(error),
                "available_model_count": 0,
                "selected_model": env_model or None,
            }
        )
    return payload


def run_matrix(args: argparse.Namespace, manifest: dict[str, Any]) -> dict[str, Any]:
    tasks = selected_tasks(manifest, args.tasks, args.limit_tasks)
    conditions = selected_conditions(manifest, args.conditions)
    if args.mode == "dry-run":
        provider: DryRunProvider | OpenAICompatibleProvider = DryRunProvider(manifest)
        provider_label = "dry-run-fixture"
        model = "fixture"
    else:
        check = provider_check(args)
        if not check.get("ok"):
            raise RuntimeError(f"Provider check failed: {check.get('reason') or check}")
        api_base = args.api_base or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com"
        api_key = args.api_key or os.environ.get("OPENAI_API_KEY") or ""
        model = args.model or os.environ.get("OPENAI_MODEL") or check["selected_model"]
        provider = OpenAICompatibleProvider(api_base=api_base, api_key=api_key, model=model)
        provider_label = api_base

    results = [
        run_condition(
            manifest=manifest,
            provider=provider,
            task=task,
            condition=condition,
            temperature=args.temperature,
            timeout_seconds=args.timeout_seconds,
        )
        for task in tasks
        for condition in conditions
    ]
    return {
        "id": f"M4b-agent-loop-necessity-tiny-pilot-{args.mode}",
        "generated_at": utc_now(),
        "mode": args.mode,
        "source_manifest": str(args.manifest),
        "claim_boundary": manifest["claim_boundary"],
        "provider": provider_label,
        "model": model,
        "task_count": len(tasks),
        "condition_count": len(conditions),
        "results": results,
        "summary": summarize(results),
    }


def default_output_for_mode(mode: str) -> Path:
    if mode == "provider-check":
        return DEFAULT_PROVIDER_CHECK_OUTPUT
    if mode == "dry-run":
        return DEFAULT_DRY_RUN_OUTPUT
    return DEFAULT_RUN_OUTPUT


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["provider-check", "dry-run", "run"], required=True)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--api-base")
    parser.add_argument("--api-key")
    parser.add_argument("--model")
    parser.add_argument("--conditions", default="C0,C3,C4,C6,C7")
    parser.add_argument("--tasks", default="")
    parser.add_argument("--limit-tasks", type=int)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--timeout-seconds", type=int, default=60)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = repo_root()
    args.manifest = root / args.manifest
    output = root / (args.output or default_output_for_mode(args.mode))
    manifest = load_json(args.manifest)
    payload = provider_check(args) if args.mode == "provider-check" else run_matrix(args, manifest)
    write_json(output, payload)
    status = "ok" if payload.get("ok", True) else "not-ok"
    print(f"wrote {output.relative_to(root)} ({status})")
    return 0 if payload.get("ok", True) else 2


if __name__ == "__main__":
    raise SystemExit(main())
