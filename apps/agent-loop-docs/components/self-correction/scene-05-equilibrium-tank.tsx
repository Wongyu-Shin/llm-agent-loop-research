"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  LabShell,
  RangeControl,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import { stationaryUpperBound } from "./paper-model";
import {
  TANK_DEFAULTS,
  VERIFIER_BLOCK_RATES,
  type VerifierMode,
} from "./loop-model";
import styles from "./loop-scenes.module.css";

/**
 * Scene 5 primary visual — 복구·훼손 평형 수조.
 *
 * 확률 질량 1이 오답 pool(소등)과 정답 pool(네온 green)의 두 챔버에
 * 나뉘어 있고, 복구 파이프는 오답 쪽에서, 훼손 파이프는 정답 쪽에서
 * 물을 퍼 나른다. 유량이 출발 챔버의 수위에 비례하므로 수위는 두 유량이
 * 상쇄되는 천장 Upp = CS / (1 − CL + CS)에서 동적 평형을 이룬다 — round
 * 카운터와 흐름은 계속 돌지만 수위는 멈춘다. 정답 수면은 드래그해서
 * 어느 수위에서 놓아도 같은 천장으로 되돌아오고, 훼손 파이프의 verifier
 * gate(엔지니어링 예시값)는 유출을 차단해 천장 자체를 끌어올린다.
 */

const ROUNDS_PER_SECOND = 0.9;
const SPEED_RAMP_MS = 2400;
const SETTLE_EPSILON = 0.004;

const VIEW_W = 680;
const VIEW_H = 430;
const TANK_TOP = 58;
const TANK_BOTTOM = 350;
const TANK_H = TANK_BOTTOM - TANK_TOP;
const LEFT_X0 = 58;
const LEFT_X1 = 226;
const RIGHT_X0 = 444;
const RIGHT_X1 = 612;
const WALL_INSET = 4;
const REPAIR_TOP = 96;
const REPAIR_BOTTOM = 120;
const DAMAGE_TOP = 288;
const DAMAGE_BOTTOM = 312;
const GATE_X = 404;
const HANDLE_HALF = 28;

const NEON_GREEN = "#5ee97d";
const FLOW_GRAY = "#8a919c";

const VERIFIER_LABELS: Record<VerifierMode, string> = {
  none: "없음",
  external: "차단 80%",
  gate: "완전 gate",
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInCubic(x: number) {
  return x * x * x;
}

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 열린 윗면과 둥근 바닥을 가진 U자 챔버 외곽선. */
function chamberPath(x0: number, x1: number) {
  const r = 8;
  return [
    `M ${x0} ${TANK_TOP}`,
    `V ${TANK_BOTTOM - r}`,
    `Q ${x0} ${TANK_BOTTOM} ${x0 + r} ${TANK_BOTTOM}`,
    `H ${x1 - r}`,
    `Q ${x1} ${TANK_BOTTOM} ${x1} ${TANK_BOTTOM - r}`,
    `V ${TANK_TOP}`,
  ].join(" ");
}

export function EquilibriumTank() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const idPrefix = useSvgIdPrefix("equilibrium-tank");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );

  const [critiqueScore, setCritiqueScore] = useState<number>(
    TANK_DEFAULTS.critiqueScore,
  );
  const [damage, setDamage] = useState<number>(TANK_DEFAULTS.damage);
  const [verifier, setVerifier] = useState<VerifierMode>("none");
  const [visible, setVisible] = useState(false);
  const [anim, setAnim] = useState<{
    level: number;
    rounds: number;
    clock: number;
  }>({
    level: TANK_DEFAULTS.initialAccuracy,
    rounds: 0,
    clock: 0,
  });

  const critiqueScoreRef = useRef(critiqueScore);
  const damageRef = useRef(damage);
  const verifierRef = useRef(verifier);
  const draggingRef = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(
            entry.isIntersecting &&
              (entry.intersectionRatio >= 0.25 ||
                entry.intersectionRect.height / window.innerHeight >= 0.35),
          );
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Continuous rounds while visible; speed ramps 0 → 1 with ease-in every
  // time the tank (re-)enters the viewport. The level follows the paper
  // transition as a continuous flow: d(level)/d(round) = inflow − outflow,
  // so it approaches the same fixed point Upp without frame jumps.
  useEffect(() => {
    if (reducedMotion || !visible) return;
    let frame = 0;
    const startedAt = performance.now();
    let last = startedAt;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ramp = easeInCubic(Math.min(1, (now - startedAt) / SPEED_RAMP_MS));
      const roundsDelta = dt * ROUNDS_PER_SECOND * ramp;
      setAnim((current) => {
        let level = current.level;
        if (!draggingRef.current) {
          const effectiveDamage =
            damageRef.current *
            (1 - VERIFIER_BLOCK_RATES[verifierRef.current]);
          const net =
            (1 - level) * critiqueScoreRef.current - level * effectiveDamage;
          level = clamp01(level + net * roundsDelta);
        }
        return {
          level,
          rounds: current.rounds + roundsDelta,
          clock: current.clock + dt,
        };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, visible]);

  const commitCritiqueScore = (value: number) => {
    critiqueScoreRef.current = value;
    setCritiqueScore(value);
  };

  const commitDamage = (value: number) => {
    damageRef.current = value;
    setDamage(value);
  };

  const commitVerifier = (value: VerifierMode) => {
    verifierRef.current = value;
    setVerifier(value);
  };

  const setLevelFromClientY = (clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.height === 0) return;
    const viewY = ((clientY - rect.top) / rect.height) * VIEW_H;
    const next = clamp01((TANK_BOTTOM - viewY) / TANK_H);
    setAnim((current) => ({ ...current, level: next }));
  };

  const handleSurfacePointerDown = (event: PointerEvent<SVGRectElement>) => {
    if (reducedMotion) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setLevelFromClientY(event.clientY);
  };

  const handleSurfacePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    setLevelFromClientY(event.clientY);
  };

  const releaseSurface = () => {
    draggingRef.current = false;
  };

  const handleSurfaceKeyDown = (event: KeyboardEvent<SVGRectElement>) => {
    if (reducedMotion) return;
    const step = 0.05;
    let next: number | null = null;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") {
      next = clamp01(anim.level + step);
    } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
      next = clamp01(anim.level - step);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = 1;
    }
    if (next === null) return;
    event.preventDefault();
    const value = next;
    setAnim((current) => ({ ...current, level: value }));
  };

  const effectiveDamage = damage * (1 - VERIFIER_BLOCK_RATES[verifier]);
  const upperBound = stationaryUpperBound(1 - effectiveDamage, critiqueScore);
  const baseUpperBound = stationaryUpperBound(1 - damage, critiqueScore);

  // 모션 감소에서는 수렴 과정을 돌리지 않고 평형 수위 자체를 보여 준다.
  const level =
    reducedMotion && upperBound !== null ? upperBound : anim.level;

  const inflow = (1 - level) * critiqueScore;
  const attemptedOutflow = level * damage;
  const passedOutflow = level * effectiveDamage;
  const netPerRound = inflow - passedOutflow;
  const settled =
    upperBound === null
      ? Math.abs(netPerRound) <= SETTLE_EPSILON
      : Math.abs(level - upperBound) <= SETTLE_EPSILON;
  const flowing = !reducedMotion && visible;

  const surfaceY = TANK_BOTTOM - level * TANK_H;
  const darkSurfaceY = TANK_BOTTOM - (1 - level) * TANK_H;
  const ceilingY =
    upperBound === null ? null : TANK_BOTTOM - upperBound * TANK_H;
  const ghostCeilingY =
    verifier !== "none" && baseUpperBound !== null
      ? TANK_BOTTOM - baseUpperBound * TANK_H
      : null;

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatSigned = (value: number) =>
    `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)}%p`;

  // 밸브 개방도는 비율(컨트롤), 흐름 선의 굵기·속도는 유량(상태)이다.
  const repairOpening = 5 + critiqueScore * 14;
  const damageOpening = 5 + damage * 14;
  const repairStroke = 1.5 + inflow * 14;
  const attemptedStroke = 1.5 + attemptedOutflow * 14;
  const passedStroke = 1.5 + passedOutflow * 14;
  const repairDashOffset = -(anim.clock * (24 + inflow * 200));
  const damageDashOffset = anim.clock * (24 + passedOutflow * 200);

  const ceilingRows: Array<{
    mode: VerifierMode;
    effectiveDamage: number;
    ceiling: number | null;
  }> = (Object.keys(VERIFIER_BLOCK_RATES) as VerifierMode[]).map((mode) => {
    const rowDamage = damage * (1 - VERIFIER_BLOCK_RATES[mode]);
    return {
      mode,
      effectiveDamage: rowDamage,
      ceiling: stationaryUpperBound(1 - rowDamage, critiqueScore),
    };
  });

  const unreachableHeight = ceilingY === null ? 0 : ceilingY - TANK_TOP;

  return (
    <div
      ref={containerRef}
      data-equilibrium-tank
      data-verifier={verifier}
      data-settled={settled ? "true" : "false"}
      data-flowing={flowing ? "true" : "false"}
    >
      <LabShell
        title="복구·훼손 평형 수조"
        subtitle="유입과 유출이 같아지는 수위가 천장 Upp — 반복은 돌지만 수위는 멈춘다"
        legend={[
          { label: "정답 수위 · 점등", tone: "success" },
          { label: "오답 pool · 소등", tone: "neutral" },
          { label: "verifier gate · 엔지니어링", tone: "attention" },
        ]}
        stageLabel={
          reducedMotion
            ? "모션 감소 설정으로 흐름을 멈추고 평형 수위를 표시합니다 — 컨트롤은 계속 사용할 수 있습니다"
            : "화면에 보이는 동안 흐름과 round가 계속 돕니다 · 정답 수면을 드래그해 아무 수위에서나 놓아 보세요"
        }
        controls={
          <>
            <RangeControl
              id="tank-critique"
              label="CS · 오답 복구율"
              value={critiqueScore}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(critiqueScore)}
              onChange={commitCritiqueScore}
            />
            <RangeControl
              id="tank-damage"
              label="1−CL · 훼손율"
              value={damage}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(damage)}
              onChange={commitDamage}
            />
            <SegmentedControl
              label="외부 verifier · 훼손 차단 (예시값)"
              value={verifier}
              options={[
                { value: "none", label: VERIFIER_LABELS.none },
                { value: "external", label: VERIFIER_LABELS.external },
                { value: "gate", label: VERIFIER_LABELS.gate },
              ]}
              onChange={commitVerifier}
            />
          </>
        }
        status={[
          {
            label: "천장 Upp",
            value: upperBound === null ? "정의 안 됨" : formatPercent(upperBound),
          },
          { label: "Accₜ 수위", value: formatPercent(level) },
          { label: "Δ / round", value: formatSigned(netPerRound) },
          { label: "verifier", value: VERIFIER_LABELS[verifier] },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              확률 질량 1이 오답 pool과 정답 pool에 나뉘어 있고, 복구 유입 (1
              − Accₜ) × CS와 훼손 유출 Accₜ × (1 − CL)이 서로 반대 방향으로
              흐릅니다. 두 유량이 같아지는 수위가 천장 Upp = CS ÷ (1 − CL +
              CS)이며, 평형에서도 흐름은 멈추지 않고 상쇄되므로 이후의 반복은
              수위를 올리지 못합니다.
            </p>
            <table className={styles.transferTable} data-ceiling-table>
              <caption>
                현재 CS {formatPercent(critiqueScore)} · 1−CL{" "}
                {formatPercent(damage)}에서 verifier별 천장 (차단율은
                엔지니어링 예시값)
              </caption>
              <thead>
                <tr>
                  <th scope="col">외부 verifier</th>
                  <th scope="col">유효 훼손율</th>
                  <th scope="col">천장 Upp</th>
                </tr>
              </thead>
              <tbody>
                {ceilingRows.map((row) => (
                  <tr key={row.mode} data-verifier-row={row.mode}>
                    <td>{VERIFIER_LABELS[row.mode]}</td>
                    <td>{formatPercent(row.effectiveDamage)}</td>
                    <td>
                      {row.ceiling === null
                        ? "정의 안 됨"
                        : formatPercent(row.ceiling)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p data-equilibrium-summary>
              천장은 시작 수위와 무관합니다. 정답 수면을 어느 위치에서 놓아도
              수위는 천장 {upperBound === null ? "—" : formatPercent(upperBound)}
              으로 되돌아오며, 완전한 gate는 훼손 유출을 0으로 만들어 천장을
              없앱니다.
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="복구·훼손 평형 수조 시각화 스크롤 영역"
        >
          <svg
            ref={svgRef}
            className="viz-svg"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
            onPointerMove={handleSurfacePointerMove}
            onPointerUp={releaseSurface}
            onPointerCancel={releaseSurface}
          >
            <title id={titleId}>복구와 훼손이 상쇄되는 평형 수조</title>
            <desc id={descId}>
              왼쪽 오답 pool과 오른쪽 정답 pool 사이를 복구 파이프와 훼손
              파이프가 잇는다. 유량은 출발 챔버의 수위에 비례해서 정답 수위는
              두 흐름이 상쇄되는 천장 Upp에서 멈추고, round 카운터는 그 뒤에도
              계속 돈다. 정답 수면은 드래그로 옮길 수 있고 훼손 파이프의
              verifier gate를 켜면 유출이 차단되어 천장이 올라간다.
            </desc>

            <defs>
              {/* neo-nixietube-style multi-layer glow — 정답 수면 전용 */}
              <filter
                id={`${idPrefix}-glow`}
                x="-60%"
                y="-60%"
                width="220%"
                height="220%"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b3" />
                <feMerge>
                  <feMergeNode in="b3" />
                  <feMergeNode in="b2" />
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient
                id={`${idPrefix}-repair`}
                gradientUnits="userSpaceOnUse"
                x1={LEFT_X1}
                y1="0"
                x2={RIGHT_X0}
                y2="0"
              >
                <stop offset="0.15" stopColor={FLOW_GRAY} />
                <stop offset="0.85" stopColor={NEON_GREEN} />
              </linearGradient>
              <linearGradient
                id={`${idPrefix}-damage`}
                gradientUnits="userSpaceOnUse"
                x1={LEFT_X1}
                y1="0"
                x2={RIGHT_X0}
                y2="0"
              >
                <stop offset="0.15" stopColor={FLOW_GRAY} />
                <stop offset="0.85" stopColor={NEON_GREEN} />
              </linearGradient>
            </defs>

            {/* ---- 챔버 라벨 ---- */}
            <text className={styles.tankLabel} x={LEFT_X0} y="38">
              오답 pool
            </text>
            <text
              className={styles.tankSubLabel}
              x={LEFT_X1}
              y="38"
              textAnchor="end"
            >
              1−Accₜ {formatPercent(1 - level)}
            </text>
            <text className={styles.tankLabel} x={RIGHT_X0} y="38">
              정답 pool
            </text>
            <text
              className={styles.tankSubLabel}
              x={RIGHT_X1}
              y="38"
              textAnchor="end"
            >
              Accₜ {formatPercent(level)}
            </text>

            {/* ---- 오답 챔버: 소등된 물 ---- */}
            {level < 1 ? (
              <>
                <rect
                  className={styles.tankWaterDark}
                  x={LEFT_X0 + WALL_INSET}
                  y={darkSurfaceY}
                  width={LEFT_X1 - LEFT_X0 - WALL_INSET * 2}
                  height={TANK_BOTTOM - darkSurfaceY - 2}
                />
                <line
                  className={styles.tankSurfaceDark}
                  x1={LEFT_X0 + WALL_INSET}
                  y1={darkSurfaceY}
                  x2={LEFT_X1 - WALL_INSET}
                  y2={darkSurfaceY}
                />
              </>
            ) : null}
            <path className={styles.tankChamber} d={chamberPath(LEFT_X0, LEFT_X1)} />

            {/* ---- 정답 챔버: 도달 불가 구역 + 네온 수위 ---- */}
            {ceilingY !== null && unreachableHeight > 8 ? (
              <rect
                className={styles.tankSilhouette}
                x={RIGHT_X0 + WALL_INSET}
                y={TANK_TOP + 4}
                width={RIGHT_X1 - RIGHT_X0 - WALL_INSET * 2}
                height={unreachableHeight - 4}
              />
            ) : null}
            {ceilingY !== null && unreachableHeight > 30 ? (
              <text
                className={styles.unreachableLabel}
                x={(RIGHT_X0 + RIGHT_X1) / 2}
                y={TANK_TOP + unreachableHeight / 2 + 4}
                textAnchor="middle"
              >
                도달 불가
              </text>
            ) : null}
            {level > 0 ? (
              <rect
                fill={NEON_GREEN}
                fillOpacity="0.08"
                x={RIGHT_X0 + WALL_INSET}
                y={surfaceY}
                width={RIGHT_X1 - RIGHT_X0 - WALL_INSET * 2}
                height={TANK_BOTTOM - surfaceY - 2}
              />
            ) : null}
            <g filter={`url(#${idPrefix}-glow)`}>
              <line
                x1={RIGHT_X0 + WALL_INSET}
                y1={surfaceY}
                x2={RIGHT_X1 - WALL_INSET}
                y2={surfaceY}
                stroke={NEON_GREEN}
                strokeWidth="2.4"
              />
            </g>
            <path
              className={styles.tankChamber}
              d={chamberPath(RIGHT_X0, RIGHT_X1)}
            />

            {/* ---- 천장 Upp ---- */}
            {ghostCeilingY !== null && ceilingY !== null &&
            Math.abs(ghostCeilingY - ceilingY) > 6 ? (
              <>
                <line
                  className={styles.ceilingGhost}
                  x1={RIGHT_X0 - 8}
                  y1={ghostCeilingY}
                  x2={RIGHT_X1 + 8}
                  y2={ghostCeilingY}
                />
                <text
                  className={styles.ceilingGhostLabel}
                  x={RIGHT_X1 + 6}
                  y={ghostCeilingY + 14}
                  textAnchor="end"
                >
                  verifier 없음{" "}
                  {baseUpperBound === null ? "" : formatPercent(baseUpperBound)}
                </text>
              </>
            ) : null}
            {ceilingY !== null ? (
              <>
                <line
                  className={styles.ceilingLine}
                  x1={RIGHT_X0 - 8}
                  y1={ceilingY}
                  x2={RIGHT_X1 + 8}
                  y2={ceilingY}
                />
                <text
                  className={styles.ceilingLabel}
                  x={RIGHT_X1 + 8}
                  y={ceilingY - 7}
                  textAnchor="end"
                >
                  천장 Upp {formatPercent(upperBound ?? 0)}
                  {upperBound === 1 ? " · 천장 소멸" : ""}
                </text>
              </>
            ) : null}

            {/* ---- 복구 파이프: 오답 → 정답 ---- */}
            <line
              className={styles.pipeWall}
              x1={LEFT_X1}
              y1={REPAIR_TOP}
              x2={RIGHT_X0}
              y2={REPAIR_TOP}
            />
            <line
              className={styles.pipeWall}
              x1={LEFT_X1}
              y1={REPAIR_BOTTOM}
              x2={RIGHT_X0}
              y2={REPAIR_BOTTOM}
            />
            {inflow > 0.001 ? (
              <line
                x1={LEFT_X1 + 2}
                y1={(REPAIR_TOP + REPAIR_BOTTOM) / 2}
                x2={RIGHT_X0 - 2}
                y2={(REPAIR_TOP + REPAIR_BOTTOM) / 2}
                stroke={`url(#${idPrefix}-repair)`}
                strokeWidth={repairStroke}
                strokeDasharray="4 9"
                strokeDashoffset={repairDashOffset}
                strokeLinecap="round"
                opacity="0.85"
              />
            ) : null}
            {/* 밸브 개방도 = CS (컨트롤), 흐름 굵기 = 실제 유량 (상태) */}
            <path
              className={styles.valveWedge}
              d={`M ${327} ${REPAIR_TOP} H ${343} L ${335} ${
                (REPAIR_TOP + REPAIR_BOTTOM) / 2 - repairOpening / 2
              } Z`}
            />
            <path
              className={styles.valveWedge}
              d={`M ${327} ${REPAIR_BOTTOM} H ${343} L ${335} ${
                (REPAIR_TOP + REPAIR_BOTTOM) / 2 + repairOpening / 2
              } Z`}
            />
            <text
              className={styles.pipeCaption}
              x={(LEFT_X1 + RIGHT_X0) / 2}
              y={REPAIR_TOP - 22}
              textAnchor="middle"
            >
              복구 (1−Accₜ) × CS ▶
            </text>
            <text
              className={styles.pipeValue}
              x={(LEFT_X1 + RIGHT_X0) / 2}
              y={REPAIR_TOP - 8}
              textAnchor="middle"
            >
              {formatPercent(inflow)} / round
            </text>

            {/* ---- 훼손 파이프: 정답 → 오답, verifier gate 경유 ---- */}
            <line
              className={styles.pipeWall}
              x1={LEFT_X1}
              y1={DAMAGE_TOP}
              x2={RIGHT_X0}
              y2={DAMAGE_TOP}
            />
            <line
              className={styles.pipeWall}
              x1={LEFT_X1}
              y1={DAMAGE_BOTTOM}
              x2={RIGHT_X0}
              y2={DAMAGE_BOTTOM}
            />
            {attemptedOutflow > 0.001 ? (
              <line
                x1={GATE_X + 6}
                y1={(DAMAGE_TOP + DAMAGE_BOTTOM) / 2}
                x2={RIGHT_X0 - 2}
                y2={(DAMAGE_TOP + DAMAGE_BOTTOM) / 2}
                stroke={`url(#${idPrefix}-damage)`}
                strokeWidth={attemptedStroke}
                strokeDasharray="4 9"
                strokeDashoffset={damageDashOffset}
                strokeLinecap="round"
                opacity="0.85"
              />
            ) : null}
            {passedOutflow > 0.001 ? (
              <line
                x1={LEFT_X1 + 2}
                y1={(DAMAGE_TOP + DAMAGE_BOTTOM) / 2}
                x2={GATE_X - 6}
                y2={(DAMAGE_TOP + DAMAGE_BOTTOM) / 2}
                stroke={`url(#${idPrefix}-damage)`}
                strokeWidth={passedStroke}
                strokeDasharray="4 9"
                strokeDashoffset={damageDashOffset}
                strokeLinecap="round"
                opacity="0.85"
              />
            ) : null}
            <path
              className={styles.valveWedge}
              d={`M ${292} ${DAMAGE_TOP} H ${308} L ${300} ${
                (DAMAGE_TOP + DAMAGE_BOTTOM) / 2 - damageOpening / 2
              } Z`}
            />
            <path
              className={styles.valveWedge}
              d={`M ${292} ${DAMAGE_BOTTOM} H ${308} L ${300} ${
                (DAMAGE_TOP + DAMAGE_BOTTOM) / 2 + damageOpening / 2
              } Z`}
            />
            <text
              className={styles.pipeCaption}
              x={(LEFT_X1 + RIGHT_X0) / 2}
              y={DAMAGE_BOTTOM + 20}
              textAnchor="middle"
            >
              ◀ 훼손 Accₜ × (1−CL)
            </text>
            <text
              className={styles.pipeValue}
              x={(LEFT_X1 + RIGHT_X0) / 2}
              y={DAMAGE_BOTTOM + 34}
              textAnchor="middle"
            >
              {verifier === "none"
                ? `${formatPercent(passedOutflow)} / round`
                : `시도 ${formatPercent(attemptedOutflow)} → 통과 ${formatPercent(
                    passedOutflow,
                  )}`}
            </text>

            {/* ---- verifier gate (엔지니어링 적용) ---- */}
            <g
              className={styles.gateSymbol}
              data-active={verifier !== "none" ? "true" : "false"}
            >
              <g
                filter={
                  verifier !== "none" ? `url(#${idPrefix}-glow)` : undefined
                }
              >
                {[GATE_X - 5, GATE_X, GATE_X + 5].map((x) => (
                  <line
                    key={x}
                    className={styles.gateBar}
                    x1={x}
                    y1={DAMAGE_TOP - 5}
                    x2={x}
                    y2={DAMAGE_BOTTOM + 5}
                  />
                ))}
              </g>
              <text
                className={styles.gateCaption}
                x={GATE_X}
                y={DAMAGE_TOP - 12}
                textAnchor="middle"
              >
                verifier gate · 엔지니어링
              </text>
            </g>

            {/* ---- round 카운터 ---- */}
            <text className={styles.roundCounter} x={LEFT_X0} y="392">
              {reducedMotion
                ? "round 정지 · 평형 수위 표시"
                : `round ${Math.floor(anim.rounds)} · Δ ${formatSigned(
                    netPerRound,
                  )}/round · 순환 ${formatPercent(
                    Math.min(inflow, passedOutflow),
                  )}/round`}
            </text>
            <text
              className={styles.tankSubLabel}
              x={RIGHT_X1}
              y="392"
              textAnchor="end"
            >
              {settled ? "평형 — 반복해도 수위가 오르지 않음" : "수렴 중"}
            </text>

            {/* ---- 정답 수면 드래그 핸들 ---- */}
            <rect
              className={styles.surfaceHandle}
              x={RIGHT_X0}
              y={Math.max(
                TANK_TOP - HANDLE_HALF,
                Math.min(surfaceY - HANDLE_HALF, TANK_BOTTOM - HANDLE_HALF),
              )}
              width={RIGHT_X1 - RIGHT_X0}
              height={HANDLE_HALF * 2}
              fill="transparent"
              role="slider"
              tabIndex={0}
              aria-label="정답 수위 Accₜ"
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
              aria-valuetext={`정답 수위 ${formatPercent(level)}`}
              aria-disabled={reducedMotion}
              onPointerDown={handleSurfacePointerDown}
              onKeyDown={handleSurfaceKeyDown}
            />
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
