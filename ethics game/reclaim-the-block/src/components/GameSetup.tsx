import { useState } from 'react';
import { ROLES } from '../data/roles';
import TutorialOverlay from './TutorialOverlay';

interface Props {
  onStart: (playerCount: 2 | 3 | 4) => void;
}

export default function GameSetup({ onStart }: Props) {
  const [count, setCount] = useState<2 | 3 | 4>(4);
  const [showTutorial, setShowTutorial] = useState(false);

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-title">
          <h1>CO-OP WATCH</h1>
          <p className="setup-subtitle">A cooperative game about neighborhood surveillance</p>
        </div>

        <div className="setup-section">
          <h2>Number of Players</h2>
          <div className="player-count-buttons">
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                className={`count-btn ${count === n ? 'selected' : ''}`}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-section">
          <h2>Player Roles</h2>
          <div className="role-list">
            {ROLES.slice(0, count).map((r) => (
              <div key={r.id} className="role-preview" style={{ borderColor: r.colorHex }}>
                <div className="role-preview-header" style={{ background: r.colorHex }}>
                  {r.characterImage
                    ? <img src={r.characterImage} alt={r.name} className="role-preview-img" />
                    : <span className="role-emoji">{r.emoji}</span>
                  }
                </div>
                <div className="role-preview-body">
                  <div className="role-name" style={{ color: r.colorHex }}>{r.name}</div>
                  <p className="role-desc">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="tutorial-btn" onClick={() => setShowTutorial(true)}>
          How to Play
        </button>

        <button className="start-btn" onClick={() => onStart(count)}>
          Start Game
        </button>
      </div>
      {showTutorial && <TutorialOverlay fromStart onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
