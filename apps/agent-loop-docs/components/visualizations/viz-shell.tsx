import { RotateCcw } from "lucide-react";
import { useId, type ReactNode } from "react";

export function useSvgIdPrefix(prefix: string) {
  const reactId = useId().replaceAll(":", "");
  return `${prefix}-${reactId}`;
}

export function LabShell({
  title,
  subtitle,
  actions,
  controls,
  children,
  stageLabel,
  legend,
  status,
  explanation,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  stageLabel?: string;
  legend?: Array<{
    label: string;
    tone: "neutral" | "accent" | "success" | "attention" | "danger";
  }>;
  status?: Array<{ label: string; value: string }>;
  explanation?: ReactNode;
}) {
  const titleId = `${useSvgIdPrefix("lab")}-title`;

  return (
    <figure className="lab" aria-labelledby={titleId}>
      <figcaption className="lab-header">
        <div className="lab-title">
          <strong id={titleId}>{title}</strong>
          <span>{subtitle}</span>
        </div>
        {actions ? <div className="lab-header-actions">{actions}</div> : null}
      </figcaption>
      {controls ? <div className="lab-controls">{controls}</div> : null}
      <div className="lab-stage">
        {stageLabel || legend?.length ? (
          <div className="lab-stage-meta">
            {stageLabel ? <span className="stage-label">{stageLabel}</span> : <span />}
            {legend?.length ? (
              <ul className="stage-legend" aria-label="시각화 범례">
                {legend.map((item) => (
                  <li key={`${item.tone}-${item.label}`}>
                    <span className={`legend-swatch tone-${item.tone}`} aria-hidden="true" />
                    {item.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="lab-canvas">
          <span className="lab-scroll-guide" aria-hidden="true">
            ← 좌우로 탐색 →
          </span>
          {children}
        </div>
      </div>
      {status?.length ? (
        <div className="lab-statusbar" role="status" aria-live="polite" aria-atomic="true">
          {status.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {explanation ? (
        <div className="lab-explanation">{explanation}</div>
      ) : null}
    </figure>
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="lab-icon-button" type="button" onClick={onClick} aria-label="초기화" title="초기화">
      <RotateCcw aria-hidden="true" size={16} />
    </button>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="control-group">
      <span className="control-label">{label}</span>
      <div className="segmented-control" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            className={value === option.value ? "segment-button is-active" : "segment-button"}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  const inputId = `${id}-${useSvgIdPrefix("range")}`;

  return (
    <div className="control-group">
      <label htmlFor={inputId}>{label}</label>
      <div className="slider-control">
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={valueLabel}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="slider-value">{valueLabel}</span>
      </div>
    </div>
  );
}
