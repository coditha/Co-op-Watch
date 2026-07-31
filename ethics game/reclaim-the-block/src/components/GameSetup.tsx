import { useState } from 'react';
import { ROLES } from '../data/roles';

interface Props {
  onStart: (playerCount: 2 | 3 | 4) => void;
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

const ROLE_BODY = 'Each role has a unique ability usable **once per turn**:\n' +
  ROLES.map(r => `${r.emoji} **${r.name}** — ${r.specialAbility}`).join('\n');

const TUTORIAL_STEPS = [
  {
    title: 'The Situation',
    body: 'Your city is installing **surveillance cameras**, license plate readers, and smart devices across every neighborhood. Privacy is eroding and community trust is falling. You and your neighbors must **work together** to push back.',
  },
  {
    title: 'Your Goal',
    body: '**Remove all excess surveillance devices** from all 4 neighborhoods before the Privacy & Community Trust meter bottoms out — or before the **governor signs a surveillance contract at the end of Round 8**. All players win or lose together — coordinate your moves!',
  },
  {
    title: 'Taking Your Turn',
    body: '**Roll the dice** to earn actions for your turn. Use them to **move**, **remove devices**, **play cards**, or **use your special ability**. When you are done, press **End Turn** to draw 2 new Community Cards.',
  },
  {
    title: 'Moving Around',
    body: 'Moving to an adjacent road tile or device slot costs **1 action**. **Highlighted tiles** show where you can go. Navigate through the neighborhoods to reach devices you want to remove, or head to the **Town Square** in the center.',
  },
  {
    title: 'Remove Device',
    body: 'To remove a surveillance device: move into the neighborhood, tap the **device slot** to target it, select **2 Community Cards** that match the neighborhood color, then press **Remove Device**. Costs 1 action. Removing a device **raises the Privacy Meter**!',
  },
  {
    title: 'Community Cards',
    body: 'Cards come in 5 colors: **Legal (blue)**, **Organizing (yellow)**, **Media (green)**, **Political (red)**, and **Neighborhood (purple)**. You can hold up to **7 cards**. Match colors to neighborhoods — Neighborhood needs yellow, Courthouse needs blue, Downtown needs green, Civic Center needs red.',
  },
  {
    title: 'Shimmer Cards',
    body: 'Some cards have a **shimmer effect** — these are powerful one-time power-ups. Select one shimmer card and press **Play Card** (costs 1 action). Effects include drawing extra cards, removing devices instantly, blocking the Board Phase, and more.',
  },
  {
    title: 'Exchange Cards',
    body: 'You can give a teammate **1 Community Card** if you are both on the **exact same tile**. Press **Share Knowledge**, choose your teammate, then pick which card to give. Costs 1 action. Use this to pass the right color card to the right player!',
  },
  {
    title: 'Town Square',
    body: 'The **Town Square** is the center of the board. When you are there, select **4 cards** (one of each color: blue, yellow, green, red) and press **Deposit**. This clears ALL devices from the most crowded neighborhood and gives the Privacy Meter a **big boost**!',
  },
  {
    title: 'Board Phase',
    body: 'After all players have taken their turns, the city places a **new surveillance device**. A flash will highlight exactly which slot gets the device. The more neighborhoods fill up, the worse the devices get — **keep clearing them**!',
  },
  {
    title: 'Incident Cards',
    body: 'Each round has a specific **Incident Card** that can be triggered when any player draws their cards at end of turn. These cause setbacks like **dropping the Privacy Meter** or **adding more devices**. It can only happen **once per round**.',
  },
  {
    title: 'Player Special Powers',
    body: ROLE_BODY,
  },
  {
    title: 'Privacy Meter',
    body: 'Every device the city places **drops** the Privacy & Community Trust meter. If it falls **all the way down**, everyone loses. Keep it healthy by removing devices, depositing at the Town Square, and playing shimmer cards. Watch for the **red pulse** — it means danger!',
  },
  {
    title: 'Ready to Play!',
    body: 'Work together, **share cards**, use your special powers, and **clear all 4 neighborhoods** before time runs out or the Privacy Meter bottoms out. Good luck — your community is counting on you!',
  },
];

export default function GameSetup({ onStart }: Props) {
  const [count, setCount] = useState<2 | 3 | 4>(4);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  if (showTutorial) {
    const step = TUTORIAL_STEPS[tutorialStep];
    const isLast = tutorialStep === TUTORIAL_STEPS.length - 1;
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="tutorial-header">
            <button className="tutorial-back-btn" onClick={() => { setShowTutorial(false); setTutorialStep(0); }}>
              ← Back
            </button>
          </div>

          <div className="tutorial-step">
            <h2 className="tutorial-step-title">{step.title}</h2>
            <p className="tutorial-step-body">{renderBold(step.body)}</p>
          </div>

          <div className="tutorial-nav">
            <button
              className="count-btn tutorial-arrow-btn"
              onClick={() => setTutorialStep(s => Math.max(0, s - 1))}
              disabled={tutorialStep === 0}
            >
              ←
            </button>
            <div className="tutorial-dots">
              {TUTORIAL_STEPS.map((_, i) => (
                <button
                  key={i}
                  className={`tutorial-dot ${i === tutorialStep ? 'active' : ''}`}
                  onClick={() => setTutorialStep(i)}
                />
              ))}
            </div>
            {!isLast && (
              <button
                className="count-btn tutorial-arrow-btn"
                onClick={() => setTutorialStep(s => s + 1)}
              >
                →
              </button>
            )}
          </div>

          {isLast && (
            <button className="start-btn" onClick={() => onStart(count)}>
              Start Game
            </button>
          )}
        </div>
      </div>
    );
  }

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
                  <div className="role-ability">{r.specialAbility}</div>
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
    </div>
  );
}
