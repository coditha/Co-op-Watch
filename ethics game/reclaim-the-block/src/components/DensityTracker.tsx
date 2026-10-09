import { useState, useEffect, useRef } from 'react';
import { asset } from '../utils/asset';

interface Props {
  value: number;
  vertical?: boolean;
  blocked?: boolean;
  round?: number;
}

// Every density level uses the same ring camera device.
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];
const DEVICE_LABEL = 'Camera';
const DeviceImg = () => <img src={asset('/ring.gif')} alt="" className="density-device-img" />;

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

  const idx = Math.min(Math.max(value - 1, 0), LEVELS.length - 1);

  if (vertical) {
    return (
      <div className={`density-inline ${expanded ? 'expanded' : ''} ${increasing ? 'dt-increasing' : ''}`}>
        {/* Compact badge — always shows current level; tap to toggle the in-place panel */}
        <button
          className="density-inline-badge"
          onClick={round === undefined ? () => setExpanded((e) => !e) : undefined}
          title={round === undefined ? (expanded ? 'Collapse tracker' : 'Expand full tracker') : undefined}
        >
          {round === undefined && <span className="density-inline-badge-emoji"><DeviceImg /></span>}
          <span className="density-inline-badge-lv">{round !== undefined ? `Round ${round}` : `${value}`}</span>
          {round === undefined && <span className="density-inline-chevron">{expanded ? '◂' : '▸'}</span>}
        </button>

        {/* In-place expansion — full tracker unfolds beneath the badge */}
        {expanded && round === undefined && (
          <div className="density-inline-track">
            {LEVELS.map((_n, i) => (
              <div
                key={i}
                className={`density-inline-step ${i + 1 === value ? 'current' : i + 1 < value ? 'passed' : ''}`}
              >
                <span className="density-inline-emoji"><DeviceImg /></span>
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
        {LEVELS.map((_n, i) => (
          <div
            key={i}
            className={`density-step ${i + 1 === value ? 'current' : i + 1 < value ? 'passed' : ''}`}
          >
            <span className="density-emoji"><DeviceImg /></span>
            <span className="density-label">{DEVICE_LABEL}</span>
            <span className="density-num">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="density-info">
        Current device: <strong><DeviceImg /> {DEVICE_LABEL}</strong>
        {' '}(meter shift: {value <= 2 ? '-1' : value <= 4 ? '-1' : value <= 6 ? '-2' : '-3'} when placed)
      </div>
    </div>
  );
}
