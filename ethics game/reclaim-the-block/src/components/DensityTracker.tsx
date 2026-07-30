import { useState, useEffect, useRef } from 'react';

interface Props {
  value: number;
  vertical?: boolean;
  blocked?: boolean;
  round?: number;
}

const DEVICE_LABELS = ['Ring', 'Ring', 'Speaker', 'Speaker', 'Traffic', 'Traffic', 'Flock', 'Flock'];
const DEVICE_EMOJIS = ['📷', '📷', '🔊', '🔊', '🚦', '🚦', '🚗', '🚗'];

export default function DensityTracker({ value, vertical, blocked, round }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [increasing, setIncreasing] = useState(false);
  const prevValue = useRef(value);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnim = useRef(false);

  function triggerAnim() {
    setIncreasing(true);
    setExpanded(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      setIncreasing(false);
      setExpanded(false);
    }, 2200);
  }

  useEffect(() => {
    if (value > prevValue.current) {
      if (blocked) {
        pendingAnim.current = true;
      } else {
        triggerAnim();
      }
    }
    prevValue.current = value;
  }, [value]);

  useEffect(() => {
    if (!blocked && pendingAnim.current) {
      pendingAnim.current = false;
      triggerAnim();
    }
  }, [blocked]);

  const idx = Math.min(Math.max(value - 1, 0), DEVICE_EMOJIS.length - 1);

  if (vertical) {
    return (
      <div className={`density-inline ${expanded ? 'expanded' : ''} ${increasing ? 'dt-increasing' : ''}`}>
        {/* Compact badge — always shows current level; tap to toggle the in-place panel */}
        <button
          className="density-inline-badge"
          onClick={round === undefined ? () => setExpanded((e) => !e) : undefined}
          title={round === undefined ? (expanded ? 'Collapse tracker' : 'Expand full tracker') : undefined}
        >
          {round === undefined && <span className="density-inline-badge-emoji">{DEVICE_EMOJIS[idx]}</span>}
          <span className="density-inline-badge-lv">{round !== undefined ? `Round ${round}` : `${value}`}</span>
          {round === undefined && <span className="density-inline-chevron">{expanded ? '◂' : '▸'}</span>}
        </button>

        {/* In-place expansion — full tracker unfolds beneath the badge */}
        {expanded && round === undefined && (
          <div className="density-inline-track">
            {DEVICE_LABELS.map((_label, i) => (
              <div
                key={i}
                className={`density-inline-step ${i + 1 === value ? 'current' : i + 1 < value ? 'passed' : ''}`}
              >
                <span className="density-inline-emoji">{DEVICE_EMOJIS[i]}</span>
                <span className="density-inline-lv">{i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`density-tracker ${increasing ? 'dt-increasing' : ''}`}>
      <div className="density-header">
        <span className="density-title">Surveillance Density Tracker</span>
        <span className="density-value">Level {value}</span>
      </div>
      <div className="density-track">
        {DEVICE_LABELS.map((label, i) => (
          <div
            key={i}
            className={`density-step ${i + 1 === value ? 'current' : i + 1 < value ? 'passed' : ''}`}
          >
            <span className="density-emoji">{DEVICE_EMOJIS[i]}</span>
            <span className="density-label">{label}</span>
            <span className="density-num">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="density-info">
        Current device: <strong>{DEVICE_EMOJIS[value - 1]} {DEVICE_LABELS[value - 1]}</strong>
        {' '}(meter shift: {value <= 2 ? '-1' : value <= 4 ? '-1' : value <= 6 ? '-2' : '-3'} when placed)
      </div>
    </div>
  );
}
