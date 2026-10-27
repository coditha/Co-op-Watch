interface Props {
  won: boolean;
  reason?: string;
  round: number;
  privacyMeter: number;
  onRestart: () => void;
}

export default function GameOver({ won, reason, round, privacyMeter, onRestart }: Props) {
  return (
    <div className="gameover-screen">
      <div className="gameover-card">
        <div className={`gameover-title ${won ? 'won' : 'lost'}`}>
          {won ? '🏆 YOU WIN!' : '💀 GAME OVER'}
        </div>
        <div className="gameover-message">
          {won
            ? 'Every neighborhood is clear of surveillance devices and every role completed its objective. The community reclaimed the block!'
            : (reason ?? 'The Privacy and Community Trust Meter hit 0.')}
        </div>
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
