import { useState, type ReactNode } from 'react';
import { ROLES } from '../data/roles';
import { OBJECTIVES } from '../data/objectives';
import { asset } from '../utils/asset';

interface Props {
  onClose: () => void;
  rotated?: boolean;
  // Start on the first tab instead of the last one viewed (used on the start screen).
  fromStart?: boolean;
}

const DISTRICT_NAMES: Record<string, string> = {
  suburb: 'Neighborhood',
  courthouse: 'Courthouse',
  media: 'Downtown',
  politics: 'Civic Center',
};

// Colour key: card colour → card type → district it clears.
const COLOR_KEY = [
  { color: '#f59e0b', name: 'Yellow', type: 'Organizing', icon: '/community.png', district: 'suburb', landmark: '/community-center.png' },
  { color: '#3b82f6', name: 'Blue', type: 'Legal', icon: '/law.png', district: 'courthouse', landmark: '/courthouse.png' },
  { color: '#22c55e', name: 'Green', type: 'Media', icon: '/news.png', district: 'media', landmark: '/news-agency.png' },
  { color: '#ef4444', name: 'Red', type: 'Political', icon: '/civil.png', district: 'politics', landmark: '/cityhall.png' },
];

function Img({ src, className = '' }: { src: string; className?: string }) {
  return <img src={asset(src)} alt="" className={`tut-img ${className}`} />;
}

// shot: the image is a game screenshot, shown larger than a sprite icon.
function Row({ img, shot, title, children }: { img?: ReactNode; shot?: boolean; title: string; children: ReactNode }) {
  return (
    <div className="tut-row">
      {img && <div className={`tut-row-img${shot ? ' tut-row-shot' : ''}`}>{img}</div>}
      <div className="tut-row-text">
        <div className="tut-row-title">{title}</div>
        <div className="tut-row-body">{children}</div>
      </div>
    </div>
  );
}

const TABS: { id: string; label: string; content: ReactNode }[] = [
  {
    id: 'players',
    label: 'Players',
    content: (
      <>
        <p className="tut-lead">
          2 to 4 players, each with a role and a personal objective. Everyone wins or loses together.
        </p>
        <div className="tut-roles">
          {ROLES.map((r) => (
            <div key={r.id} className="tut-role" style={{ borderColor: r.colorHex }}>
              <div className="tut-role-head" style={{ background: r.colorHex }}>
                {r.characterImage && <img src={r.characterImage} alt="" className="tut-role-img" />}
              </div>
              <div className="tut-role-body">
                <div className="tut-role-name" style={{ color: r.colorHex }}>{r.name}</div>
                <div className="tut-role-home">Home: {DISTRICT_NAMES[r.homeNeighborhood]}</div>
                <p className="tut-role-desc">{r.description}</p>
                <p className="tut-role-desc"><strong>Objective:</strong> {OBJECTIVES[r.id].short}.</p>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'actions',
    label: 'Action Points',
    content: (
      <>
        <Row img={<Img src="/tutorial/turn-dice.png" />} shot title="Roll the dice">
          At the start of your turn, your roll (2, 4 or 6) is how many <strong>action points</strong> you get.
        </Row>
        <Row img={<Img src="/tutorial/turn-move.png" />} shot title="Move: 1 action per step">
          Tiles with a <strong>white outline</strong> show where you can move. Your pawn glows <strong>gold</strong> on your turn.
        </Row>
        <Row title="Remove Device: 1 action + 3 same color cards">
          Stand in a district and pick a device. You need <strong>3 cards in that district's color</strong>.
          The game uses matching cards from your hand automatically. Raises the meter by 1.
        </Row>
        <Row title="Deposit Cards: 1 action + 4 colors">
          At the Town Square, spend <strong>4 cards of different colors</strong> (one of each).
          This clears <strong>every device</strong> in the most crowded district and raises the meter by 5.
        </Row>
        <Row title="Transfer Card: 1 action">
          On the same tile as a teammate, give them 1 card. Once per round. If they already hold 7, they first choose 1 card to discard.
        </Row>
        <div className="tut-key">
          {COLOR_KEY.map((k) => (
            <div key={k.name} className="tut-key-row" style={{ borderColor: k.color }}>
              <span className="tut-key-swatch" style={{ background: k.color }}><Img src={k.icon} /></span>
              <span className="tut-key-type" style={{ color: k.color }}>{k.type}</span>
              <span className="tut-key-arrow">→</span>
              <Img src={k.landmark} className="tut-key-landmark" />
              <span className="tut-key-district">{DISTRICT_NAMES[k.district]}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: 'turns',
    label: 'Turns',
    content: (
      <>
        <Row title="Taking turns">
          Players go one at a time around the table. On your turn you roll, spend your action points, then end your turn.
        </Row>
        <Row img={<Img src="/tutorial/turn-cards.png" />} shot title="End your turn">
          <strong>End Turn</strong> is free and draws <strong>1 card</strong>. You can hold up to <strong>7</strong>. If you go over, you choose which to discard.
        </Row>
        <Row title="After the last player">
          When everyone has had a turn, the round ends with a Surveillance Incident and a Board Event.
        </Row>
      </>
    ),
  },
  {
    id: 'round',
    label: 'Incident & Board Event',
    content: (
      <>
        <Row img={<Img src="/warning.png" />} title="Surveillance Incident (every round)">
          After the last player's turn, the city makes a proposal. Pick one of the <strong>4 responses</strong> on either card.
          Your pick shows on both, so decide together, then press <strong>Confirm</strong>.
        </Row>
        <Row img={<Img src="/caution.png" />} title="Board Event">
          Your choice plays out. It can <strong>add devices</strong>, <strong>remove devices</strong>, change the meter, or a mix.
          Removed devices come from the district the card names, or the most crowded one. A flash shows where a new device lands.
        </Row>
      </>
    ),
  },
  {
    id: 'win',
    label: 'How to Win',
    content: (
      <>
        <Row title="Clear the board">
          Remove <strong>every device from all 4 districts</strong> and the game ends. It starts with <strong>4 devices</strong> (2 players) or <strong>8 devices</strong> (3 or 4 players).
        </Row>
        <Row title="Full Victory">
          Each role in play has one objective, shown on that player's panel with a checkbox. Clear the board <strong>and</strong> finish every objective for a Full Victory.
        </Row>
        <Row title="Survived">
          Clear the board with some objectives missed and the community still survives. Objectives are a bonus, not a requirement.
        </Row>
        <Row title="Win early for a story ending">
          Clear the board before round 8 and the council vote never has to happen. You get a story ending that shows how Maplewood's story finishes.
        </Row>
      </>
    ),
  },
  {
    id: 'lose',
    label: 'How to Lose',
    content: (
      <>
        <Row title="Trust hits 0">
          The <strong>Privacy &amp; Community Trust</strong> meter hits 0.
        </Row>
        <Row title="Out of time">
          <strong>Round 8</strong> ends before the board is clear.
        </Row>
        <Row title="The meter">
          Starts at 20 out of 30. Incident choices can raise or lower it. Removing devices and depositing at the Town Square raise it. It pulses red at 5 or below.
        </Row>
      </>
    ),
  },
];

// In-game, reopen on the tab the players last looked at.
let lastTab = 0;

export default function TutorialOverlay({ onClose, rotated, fromStart }: Props) {
  const [tab, setTabState] = useState(fromStart ? 0 : lastTab);
  const setTab = (i: number) => { lastTab = i; setTabState(i); };

  return (
    <div className={`tutorial-overlay${rotated ? ' overlay-rotated' : ''}`} onClick={onClose}>
      <div className="tutorial-overlay-panel tut-panel" onClick={e => e.stopPropagation()}>
        <div className="tutorial-overlay-header">
          <span className="tutorial-overlay-title">How to Play</span>
          <button className="tutorial-overlay-close" onClick={onClose}>✕</button>
        </div>

        <div className="tut-tabs" role="tablist">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={i === tab}
              className={`tut-tab${i === tab ? ' active' : ''}`}
              onClick={() => setTab(i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="tut-content" role="tabpanel">{TABS[tab].content}</div>

        <div className="tutorial-overlay-nav">
          <button className="tutorial-overlay-nav-btn" onClick={() => setTab(tab - 1)} disabled={tab === 0}>
            ← {tab > 0 ? TABS[tab - 1].label : ''}
          </button>
          {tab < TABS.length - 1 ? (
            <button className="tutorial-overlay-nav-btn" onClick={() => setTab(tab + 1)}>
              {TABS[tab + 1].label} →
            </button>
          ) : (
            <button className="tutorial-overlay-nav-btn tutorial-overlay-done" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
