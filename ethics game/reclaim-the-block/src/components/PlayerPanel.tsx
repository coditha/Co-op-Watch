import type { Player, CommunityCard } from '../types/game';
import CardDisplay from './CardDisplay';

interface Props {
  player: Player;
  isActive: boolean;
  selectedCardIds: string[];
  onCardClick: (card: CommunityCard) => void;
}

const POSITION_LABELS: Record<string, string> = {
  suburb: 'Neighborhood', courthouse: 'Courthouse', media: 'Downtown', politics: 'Civic Center',
  'city-hall': 'Town Square',
  'suburb-n1': 'Neighborhood N1', 'suburb-n2': 'Neighborhood N2', 'suburb-n3': 'Neighborhood N3', 'suburb-n4': 'Neighborhood N4',
  'courthouse-n1': 'Courthouse N1', 'courthouse-n2': 'Courthouse N2', 'courthouse-n3': 'Courthouse N3', 'courthouse-n4': 'Courthouse N4',
  'media-n1': 'Downtown N1', 'media-n2': 'Downtown N2', 'media-n3': 'Downtown N3', 'media-n4': 'Downtown N4',
  'politics-n1': 'Civic Center N1', 'politics-n2': 'Civic Center N2', 'politics-n3': 'Civic Center N3', 'politics-n4': 'Civic Center N4',
  'suburb-road-1': 'Road (Neighborhood→City)', 'suburb-road-2': 'Road (City→Neighborhood)',
  'courthouse-road-1': 'Road (Courthouse→City)', 'courthouse-road-2': 'Road (City→Courthouse)',
  'media-road-1': 'Road (Downtown→City)', 'media-road-2': 'Road (City→Downtown)',
  'politics-road-1': 'Road (Civic Center→City)', 'politics-road-2': 'Road (City→Civic Center)',
};

export default function PlayerPanel({ player, isActive, selectedCardIds, onCardClick }: Props) {
  return (
    <div
      className={`player-panel ${isActive ? 'active-player' : ''}`}
      style={{ borderColor: player.role.colorHex }}
    >
      <div className="player-header" style={{ background: player.role.colorHex }}>
        <span className="player-role-emoji">{player.role.emoji}</span>
        <div className="player-info">
          <span className="player-role-name">{player.role.name}</span>
          <span className="player-position">📍 {POSITION_LABELS[player.position] ?? player.position}</span>
        </div>
        {isActive && <span className="active-badge">ACTIVE</span>}
      </div>

      <div className="player-hand-header">
        Hand ({player.hand.length}/7)
      </div>

      <div className="player-hand">
        {player.hand.length === 0 ? (
          <div className="empty-hand">No cards</div>
        ) : (
          player.hand.map((card) => (
            <CardDisplay
              key={card.id}
              card={card}
              isSelected={selectedCardIds.includes(card.id)}
              onClick={() => onCardClick(card)}
            />
          ))
        )}
      </div>
    </div>
  );
}
