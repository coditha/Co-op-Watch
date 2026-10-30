import { ROLES } from '../data/roles';
import { OBJECTIVES } from '../data/objectives';

interface Props {
  won: boolean;
  objectives: Record<string, boolean>;
  reason?: string;
  round: number;
  privacyMeter: number;
  onRestart: () => void;
}

export default function GameOver({ won, objectives, reason, round, privacyMeter, onRestart }: Props) {
  // Board cleared: every objective done is a full victory, otherwise the group "survived".
  const full = won && Object.values(objectives).every(Boolean);
  const title = !won ? '💀 GAME OVER' : full ? '🏆 FULL VICTORY!' : '🌱 SURVIVED';
  const message = !won
    ? (reason ?? 'The Privacy and Community Trust Meter hit 0.')
    : full
      ? 'Every neighborhood is clear of surveillance devices and every role completed its objective. The community reclaimed the block!'
      : 'Every neighborhood is clear of surveillance devices, but not every role completed its objective. The community survived.';
  const inPlay = ROLES.filter((r) => r.id in objectives);
  return (
    <div className="gameover-screen">
      <div className="gameover-card">
        <div className={`gameover-title ${won ? 'won' : 'lost'}`}>{title}</div>
        <div className="gameover-message">{message}</div>
        <ul className="gameover-objectives">
          {inPlay.map((r) => (
            <li key={r.id} className={objectives[r.id] ? 'done' : ''}>
              {objectives[r.id] ? '✔' : '✘'} <strong>{r.name}:</strong> {OBJECTIVES[r.id].short}
            </li>
          ))}
        </ul>
        <div className="gameover-stats">
          <div className="stat">
            <span className="stat-label">Rounds survived</span>
            <span className="stat-value">{Math.min(round, 8)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Final meter</span>
            <span className="stat-value">{privacyMeter}</span>
          </div>
        </div>
        {!won && (
          <div className="gameover-reflection">
            <p>
              Real neighborhoods face this pressure every day — surveillance devices accumulate faster
              than communities can organize. But communities <em>have</em> reclaimed their blocks.
              It takes sustained cooperation.
            </p>
          </div>
        )}
        <button className="start-btn" onClick={onRestart}>
          Play Again
        </button>
      </div>
    </div>
  );
}
