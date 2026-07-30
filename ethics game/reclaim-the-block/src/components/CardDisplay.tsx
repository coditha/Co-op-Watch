import type { CommunityCard } from '../types/game';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { asset } from '../utils/asset';

interface Props {
  card: CommunityCard;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  yellow: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#a855f7',
};

const CATEGORY_LABELS: Record<string, string> = {
  blue: 'Legal',
  yellow: 'Organizing',
  green: 'Media',
  red: 'Political',
  purple: 'Neighborhood',
};

const CATEGORY_ICONS: Record<string, string> = {
  blue: '⚖️',
  yellow: '🤝',
  green: '📰',
  red: '🏛️',
  purple: '🏘️',
};

// Categories with a dedicated pixel-art image instead of an emoji.
const CATEGORY_ICON_IMAGES: Partial<Record<string, string>> = {
  blue: 'law.png',
  green: 'news.png',
  red: 'civil.png',
  yellow: 'community.png',
};

function CategoryIcon({ category, className }: { category: string; className: string }) {
  const image = CATEGORY_ICON_IMAGES[category];
  if (image) return <img src={asset(`/${image}`)} alt="" className={className} />;
  return <span className={className}>{CATEGORY_ICONS[category]}</span>;
}

export default function CardDisplay({ card, isSelected, onClick, disabled }: Props) {
  const [showModal, setShowModal] = useState(false);
  const color = CATEGORY_COLORS[card.category];

  return (
    <div
      className={`card ${isSelected ? 'card-selected' : ''} ${disabled ? 'card-disabled' : ''} ${card.isPowerUp ? 'card-powerup' : ''}`}
      style={{ borderColor: color }}
      onClick={!disabled ? onClick : undefined}
      onDoubleClick={(e) => { e.stopPropagation(); setShowModal(true); }}
    >
      {/* Header band */}
      <div className="card-top" style={{ background: color }}>
        <span className="card-category">{CATEGORY_LABELS[card.category]}</span>
      </div>
      {/* Art zone */}
      <div className="card-art">
        <CategoryIcon category={card.category} className="card-art-icon" />
      </div>
      {/* Body */}
      <div className="card-name" style={{ color }}>{card.name}</div>
      <div className="card-desc">{card.educationalContent}</div>
      <div className="card-effect">{card.effect}</div>

      {/* Enlarged detail popup — portaled to body so it escapes the fan's overflow clipping */}
      {showModal &&
        createPortal(
          <div className="card-modal-overlay" onClick={() => setShowModal(false)}>
            <div
              className={`card-modal-border${card.isPowerUp ? ' card-modal-powerup-shine' : ''}`}
              style={{ background: color, ['--card-color' as string]: color }}
              onClick={(e) => e.stopPropagation()}
            >
            <div
              className="card-modal"
            >
              {/* Header band */}
              <div className="card-modal-top" style={{ background: color }}>
                <span className="card-modal-category">{CATEGORY_LABELS[card.category]}</span>
              </div>
              {/* Art zone */}
              <div className="card-modal-art">
                <CategoryIcon category={card.category} className="card-modal-art-icon" />
              </div>
              {/* Body */}
              <div className="card-modal-body">
                <div className="card-modal-name" style={{ color }}>{card.name}</div>
                <div className="card-modal-edu">{card.educationalContent}</div>
                <div className="card-modal-effect">{card.effect}</div>
              </div>
              <button className="card-modal-ok" onClick={() => setShowModal(false)}>OK</button>
            </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
