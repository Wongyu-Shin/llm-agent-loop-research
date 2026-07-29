#!/usr/bin/env python3
"""Run LLM-as-judge reviews for the M4b LinkedIn/blog content package."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MODEL_PREFERENCES = [
    "gpt-5.4-mini",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.2",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o",
    "gpt-4o-mini",
]


PERSPECTIVES = [
    {
        "id": "math_stats",
        "name": "수학/통계 리뷰어",
        "focus": "확률, 최적화, causal claim, pilot interpretation, overclaim 방지",
    },
    {
        "id": "llm_systems",
        "name": "LLM 시스템 엔지니어",
        "focus": "agent loop, verifier, tool use, feedback, state control의 공학적 정확성",
    },
    {
        "id": "software_architecture",
        "name": "소프트웨어 아키텍처 리뷰어",
        "focus": "실무자가 가져갈 설계 원칙, Fowler식 boundary, architecture vocabulary",
    },
    {
        "id": "control_rl",
        "name": "제어/RL 리뷰어",
        "focus": "closed-loop control, observation, policy, state update, reward/task utility framing",
    },
    {
        "id": "editorial",
        "name": "기술 에세이 편집자",
        "focus": "Joel/Fowler급 명료성, 기억나는 문장, 독립 완결성, LinkedIn/blog 독자 경험",
    },
]


MODE_PROMPTS = {
    "outline": "Review this outline before the article is written.",
    "blog": "Review this full standalone blog post.",
    "card_topics": "Review these proposed LinkedIn card-news topics.",
    "card_copy": "Review the final LinkedIn card copy and caption.",
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def api_v1_base(raw_base: str) -> str:
    base = raw_base.rstrip("/")
    return base if base.endswith("/v1") else f"{base}/v1"


def request_json(
    *,
    method: str,
    url: str,
    api_key: str,
    body: dict[str, Any] | None = None,
    timeout_seconds: int = 90,
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
        raise RuntimeError(f"HTTP {error.code}: {detail[:1000]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Provider request failed: {error}") from error


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


def choose_model(api_base: str, api_key: str, timeout_seconds: int) -> str:
    configured = os.environ.get("OPENAI_MODEL")
    if configured:
        return configured
    payload = request_json(
        method="GET",
        url=f"{api_v1_base(api_base)}/models",
        api_key=api_key,
        timeout_seconds=timeout_seconds,
    )
    models = sorted(
        item["id"]
        for item in payload.get("data", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    )
    available = set(models)
    for candidate in MODEL_PREFERENCES:
        if candidate in available:
            return candidate
    chat_like = [model for model in models if looks_chat_capable(model)]
    if not chat_like:
        raise RuntimeError("No chat-capable model discovered.")
    return chat_like[0]


def chat(
    *,
    api_base: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    timeout_seconds: int,
) -> str:
    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "stream": False,
    }
    start = time.time()
    try:
        payload = request_json(
            method="POST",
            url=f"{api_v1_base(api_base)}/chat/completions",
            api_key=api_key,
            body=body,
            timeout_seconds=timeout_seconds,
        )
    except RuntimeError as error:
        if "temperature" not in str(error).lower():
            raise
        body.pop("temperature", None)
        payload = request_json(
            method="POST",
            url=f"{api_v1_base(api_base)}/chat/completions",
            api_key=api_key,
            body=body,
            timeout_seconds=timeout_seconds,
        )
    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError(f"No choices returned after {time.time() - start:.1f}s.")
    return str((choices[0].get("message") or {}).get("content") or "")


def extract_json(text: str) -> dict[str, Any]:
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
    if not match:
        return {"parse_error": "no_json_object", "raw": text}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as error:
        return {"parse_error": str(error), "raw": text}


def build_messages(mode: str, perspective: dict[str, str], content: str, context: str) -> list[dict[str, str]]:
    rubric = """
Return only JSON with this schema:
{
  "perspective": "...",
  "score": 0-10,
  "verdict": "pass|revise|fail",
  "strongest_points": ["...", "..."],
  "highest_risk_issues": ["...", "..."],
  "required_revisions": ["...", "..."],
  "optional_revisions": ["...", "..."],
  "overclaim_check": "no major overclaim|minor overclaim|major overclaim",
  "standalone_check": "self-contained|needs context",
  "quality_bar_check": "below|near|meets|exceeds"
}
Use a high bar: Joel/Fowler-level means useful, precise, memorable, and durable.
"""
    return [
        {
            "role": "system",
            "content": (
                "You are a strict multidisciplinary reviewer for a Korean technical essay "
                "and LinkedIn card-news package. Be constructive but demanding. "
                "Do not praise vague content. Penalize overclaims and unsupported evidence."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Mode: {mode}\n"
                f"Task: {MODE_PROMPTS[mode]}\n"
                f"Perspective: {perspective['name']}\n"
                f"Focus: {perspective['focus']}\n\n"
                f"Shared context:\n{context}\n\n"
                f"Rubric:\n{rubric}\n\n"
                f"Artifact to review:\n{content}"
            ),
        },
    ]


def summarize_reviews(reviews: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [review.get("score") for review in reviews if isinstance(review.get("score"), (int, float))]
    verdicts = [review.get("verdict") for review in reviews]
    return {
        "average_score": round(sum(scores) / len(scores), 3) if scores else None,
        "min_score": min(scores) if scores else None,
        "verdict_counts": {verdict: verdicts.count(verdict) for verdict in sorted(set(verdicts))},
        "all_pass": bool(scores) and min(scores) >= 8.5 and all(v == "pass" for v in verdicts),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=sorted(MODE_PROMPTS), required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--context", type=Path, action="append", default=[])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--api-base", default=os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com")
    parser.add_argument("--api-key", default=os.environ.get("OPENAI_API_KEY") or "")
    parser.add_argument("--model")
    parser.add_argument("--timeout-seconds", type=int, default=120)
    args = parser.parse_args()

    root = repo_root()
    input_path = root / args.input
    output_path = root / args.output
    content = input_path.read_text(encoding="utf-8")
    context = "\n\n".join((root / path).read_text(encoding="utf-8") for path in args.context)
    if not args.api_key and not args.api_base.startswith(("http://127.0.0.1", "http://localhost")):
        raise RuntimeError("OPENAI_API_KEY is required for non-local providers.")
    model = args.model or choose_model(args.api_base, args.api_key, args.timeout_seconds)

    reviews = []
    for perspective in PERSPECTIVES:
        raw = chat(
            api_base=args.api_base,
            api_key=args.api_key,
            model=model,
            messages=build_messages(args.mode, perspective, content, context),
            timeout_seconds=args.timeout_seconds,
        )
        parsed = extract_json(raw)
        parsed.setdefault("perspective", perspective["id"])
        parsed["perspective_id"] = perspective["id"]
        reviews.append(parsed)

    payload = {
        "id": f"m4b-content-judge-{args.mode}",
        "generated_at": utc_now(),
        "mode": args.mode,
        "input": str(args.input),
        "model": model,
        "review_count": len(reviews),
        "summary": summarize_reviews(reviews),
        "reviews": reviews,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {args.output}")
    print(json.dumps(payload["summary"], ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
