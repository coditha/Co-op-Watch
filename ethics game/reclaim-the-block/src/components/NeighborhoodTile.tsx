import type { Neighborhood, Player, DeviceType, SlotIndex, Position } from '../types/game';
import { getReachablePositions } from '../store/gameReducer';
import { asset } from '../utils/asset';

interface Props {
  neighborhood: Neighborhood;
  players: Player[];
  isSelected: boolean;
  onSelect: () => void;
  onSlotClick: (slotIndex: SlotIndex) => void;
  selectedSlot: SlotIndex | null;
  canMove: boolean;
  activePlayerPosition: string;
  activePlayerId?: number;
  onMove: (position: Position) => void;
  flashSlot?: number | null;
  facesTop?: boolean;
}

const DEVICE_EMOJI: Record<DeviceType, string> = {
  ring: '📷',
  'smart-speaker': '🔊',
  'traffic-camera': '🚦',
  'flock-reader': '🚗',
};
const DEVICE_IMAGE: Partial<Record<DeviceType, string>> = {
  ring: asset('/ring.png'),
};

const DEVICE_LABEL: Record<DeviceType, string> = {
  ring: 'Ring',
  'smart-speaker': 'Speaker',
  'traffic-camera': 'Traffic Cam',
  'flock-reader': 'Flock Reader',
};

const NEIGHBORHOOD_COLORS: Record<string, string> = {
  suburb: '#f59e0b',
  courthouse: '#3b82f6',
  media: '#22c55e',
  politics: '#ef4444',
};

// Landmark that gives each district its identity (Pelican-Town style).
// Placeholder emoji — swap `.district-landmark.lm-<id>` to a background
// sprite in CSS later without touching this component.
const LANDMARK_EMOJI: Record<string, string> = {
  suburb: '',         // Community center (uses sprite)
  courthouse: '',      // Courthouse (uses sprite)
  media: '',          // News agency (uses sprite)
  politics: '',       // Government building (uses city-hall sprite)
};

const SLOT_LABELS = ['N1', 'N2', 'N3', 'N4'];

// Winding road loop (in a 0–100 coordinate space) threading through the
// node positions: N1(50,8) → nr1(80,20) → N2(87,50) → nr2(80,80) →
// N4(50,92) → nr3(20,80) → N3(13,50) → nr4(20,20) → back to N1.
// Smooth closed curve so the streets bend organically between houses.
const ROADS_PATH =
  'M50,8 C60,8 73.8,13 80,20 C86.2,27 87,40 87,50 C87,60 86.2,73 80,80 ' +
  'C73.8,87 60,92 50,92 C40,92 26.2,87 20,80 C13.8,73 13,60 13,50 ' +
  'C13,40 13.8,27 20,20 C26.2,13 40,8 50,8 Z';

function slotPositionOf(position: string, neighborhoodId: string): number | null {
  const match = position.match(new RegExp(`^${neighborhoodId}-n(\\d)$`));
  return match ? parseInt(match[1]) - 1 : null;
}

export default function NeighborhoodTile({
  neighborhood,
  players,
  isSelected,
  onSelect,
  onSlotClick,
  selectedSlot,
  canMove,
  activePlayerPosition,
  activePlayerId,
  onMove,
  flashSlot,
  facesTop,
}: Props) {
  const color = NEIGHBORHOOD_COLORS[neighborhood.id];
  const filledSlots = neighborhood.slots.filter(Boolean).length;
  const isCurrentNeighborhood =
    activePlayerPosition === neighborhood.id ||
    activePlayerPosition.startsWith(neighborhood.id + '-n');
  const roadTile = `${neighborhood.id}-road-1` as Position;
  const isOnRoadToThis = activePlayerPosition === roadTile;
  const reachableFromHere = canMove ? getReachablePositions(activePlayerPosition as Position) : [];
  // Clicking the tile moves to this neighborhood's road-1 waypoint (first step)
  const tileMoveable = canMove && !isCurrentNeighborhood && !isOnRoadToThis && reachableFromHere.includes(roadTile);

  return (
    <div
      className={`neighborhood-tile district-${neighborhood.id} ${isSelected ? 'selected' : ''} ${filledSlots === 4 ? 'full' : ''} ${tileMoveable ? 'moveable' : ''}`}
      style={{ borderColor: color }}
      onClick={() => {
        if (tileMoveable) onMove(roadTile);
        onSelect();
      }}
    >
      <div className={`neighborhood-header${facesTop ? ' header-flipped' : ''}`} style={{ background: color }}>
        <span className="neighborhood-name">{neighborhood.name}</span>
        <span className="neighborhood-density">{filledSlots}/4</span>
      </div>

      {/* Baseline devices — always 4, printed on board */}
      <div className="baseline-devices">
        {Array(4).fill(null).map((_, i) => (
          <span key={i} className="baseline-device" title="Baseline device (cannot remove)">📹</span>
        ))}
      </div>

      {/* Decorative trees scattered around the district (purely cosmetic) */}
      <span className="district-tree dt-1" aria-hidden="true">🌳</span>
      <span className="district-tree dt-2" aria-hidden="true">🌲</span>
      <span className="district-tree dt-3" aria-hidden="true">🌳</span>

      {/* Houses (device slots) scattered around the landmark, linked by paths */}
      <div className="device-slots-square">
        {/* Winding streets — drawn behind the houses and landmark */}
        <svg className="district-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="road-edge" d={ROADS_PATH} />
          <path className="road-fill" d={ROADS_PATH} />
        </svg>
        {/* Central landmark — the district's identity. Swap to a sprite via
            .district-landmark.lm-<id> { background-image: url(...) } later. */}
        <div className={`district-landmark lm-${neighborhood.id}`} aria-hidden="true">
          {LANDMARK_EMOJI[neighborhood.id]}
        </div>
        {/* Render helper: a device slot */}
        {([0, 1, 2, 3] as const).map((i) => {
          const slotPos = `${neighborhood.id}-n${i + 1}` as Position;
          const device = neighborhood.slots[i];
          const playersOnSlot = players.filter(
            (p) => slotPositionOf(p.position, neighborhood.id) === i
          );
          const slotMoveable = canMove && reachableFromHere.includes(slotPos);
          const isActivePlayerHere = activePlayerPosition === slotPos;
          const slotRemoveable = canMove && isCurrentNeighborhood && device !== null && !isActivePlayerHere;
          return (
            <div
              key={`slot-${i}`}
              className={`device-slot sq-slot-${i + 1} ${device ? 'occupied' : 'empty'} ${selectedSlot === i ? 'slot-selected' : ''} ${playersOnSlot.length > 0 ? 'player-here' : ''} ${slotMoveable ? 'slot-moveable' : ''} ${isActivePlayerHere ? 'active-player-here' : ''} ${slotRemoveable ? 'slot-removeable' : ''} ${flashSlot === i ? 'slot-flash' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (slotMoveable) onMove(slotPos);
                onSlotClick(i as SlotIndex);
              }}
              title={device ? `${DEVICE_LABEL[device]} — click to target` : `Empty slot ${SLOT_LABELS[i]}`}
            >
              {device ? (
                <span className="device-token">
                  {DEVICE_IMAGE[device]
                    ? <img src={DEVICE_IMAGE[device]} alt={DEVICE_LABEL[device]} className="device-token-img" />
                    : DEVICE_EMOJI[device]}
                </span>
              ) : null}
              {playersOnSlot.length > 0 && (
                <div className="slot-pawns">
                  {playersOnSlot.map((p) => (
                    <span key={p.id} className={`slot-pawn${p.id === activePlayerId ? ' active-pawn' : ''}`} title={p.role.name}
                      style={{ color: p.role.colorHex }}>
                      {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {/* Road tiles: nr1=top(H), nr2=right(V), nr3=bottom(H), nr4=left(V) */}
        {(['nr1', 'nr2', 'nr3', 'nr4'] as const).map((nrKey) => {
          const roadPos = `${neighborhood.id}-${nrKey}` as Position;
          const isH = nrKey === 'nr1' || nrKey === 'nr3';
          const roadMoveable = canMove && reachableFromHere.includes(roadPos);
          const isActivePlayerOnRoad = activePlayerPosition === roadPos;
          const playersOnRoad = players.filter((p) => p.position === roadPos);
          return (
            <div
              key={nrKey}
              className={`int-road-seg sq-road-${nrKey} ${isH ? 'seg-h' : 'seg-v'} ${roadMoveable ? 'moveable' : ''} ${isActivePlayerOnRoad ? 'active-player-here' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (roadMoveable) onMove(roadPos);
              }}
              title={`Road ${nrKey}`}
            >
              <div className={isH ? 'int-line-h' : 'int-line-v'} />
              <div className="int-waypoint">
                {playersOnRoad.map((p) => (
                  <span key={p.id} className={`slot-pawn${p.id === activePlayerId ? ' active-pawn' : ''}`} title={p.role.name}
                    style={{ color: p.role.colorHex }}>
                    {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                  </span>
                ))}
              </div>
              <div className={isH ? 'int-line-h' : 'int-line-v'} />
            </div>
          );
        })}
        {/* Empty center */}
        <div className="sq-center" />
      </div>


      {/* Players here — removed: players now always start at N1 and show on slots */}
    </div>
  );
}
