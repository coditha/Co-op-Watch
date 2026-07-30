import { useReducer, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { gameReducer, buildInitialState, getReachablePositions } from './store/gameReducer';
import { asset } from './utils/asset';
import { getBoardPhaseEvent } from './data/roundConfig';
import type { GameAction } from './store/gameReducer';
import type { NeighborhoodId, SlotIndex, CommunityCard, Player, GameState, ResolvedIncident } from './types/game';
import GameSetup from './components/GameSetup';
import GameOver from './components/GameOver';
import PrivacyMeter from './components/PrivacyMeter';
import DensityTracker from './components/DensityTracker';
import NeighborhoodTile from './components/NeighborhoodTile';
import CardDisplay from './components/CardDisplay';
import ActionPanel from './components/ActionPanel';
import GameLog from './components/GameLog';
import RevealedCards from './components/RevealedCards';
import TutorialOverlay from './components/TutorialOverlay';
import CenterDiceRoll from './components/CenterDiceRoll';
import RoleOverlay from './components/RoleOverlay';

const DRAWN_CARD_LABELS: Record<string, string> = {
  blue: 'Legal', yellow: 'Organizing', green: 'Media', red: 'Political', purple: 'Neighborhood',
};
const DRAWN_CARD_ICONS: Record<string, string> = {
  blue: '⚖️', yellow: '🤝', green: '📰', red: '🏛️', purple: '🏘️',
};
// Categories with a dedicated pixel-art image instead of an emoji.
const DRAWN_CARD_ICON_IMAGES: Partial<Record<string, string>> = {
  blue: 'law.png',
  green: 'news.png',
  red: 'civil.png',
  yellow: 'community.png',
};
const DRAWN_CARD_COLORS: Record<string, string> = {
  blue: '#3b82f6', yellow: '#f59e0b', green: '#22c55e', red: '#ef4444', purple: '#a855f7',
};

// ── Corner hand tray ───────────────────────────────────────────────────────

function CornerPanel({
  player,
  isActive,
  hasMoved,
  selectedCardIds,
  onCardClick,
  pendingDiscard,
  pendingDiscardCount,
}: {
  player: Player;
  isActive: boolean;
  hasMoved?: boolean;
  pendingDiscard?: boolean;
  pendingDiscardCount?: number;
  selectedCardIds: string[];
  onCardClick: (card: CommunityCard) => void;
}) {
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  // Horizontal overlap layout: cards spread evenly, overlap increases with hand size
  const n = player.hand.length;
  const CARD_W = 124; // px, fixed — never shrinks

  return (
    <div
      className={`corner-panel ${isActive ? 'corner-active' : ''} ${isActive && hasMoved ? 'corner-moved' : ''} ${pendingDiscard ? 'corner-discarding' : ''}`}
      style={{ borderColor: player.role.colorHex }}
    >
      <div className="corner-header" style={{ background: player.role.colorHex }}>
        {player.role.characterImage
          ? <span className="corner-emoji corner-pawn-circle"><img src={player.role.characterImage} alt={player.role.name} className="pawn-img corner-pawn-img" /></span>
          : <span className="corner-emoji">{player.role.emoji}</span>}
        <div className="corner-info">
          <span className="corner-name">{player.role.name}</span>
        </div>
        <span className="corner-hand-count">{player.hand.length}/7</span>
      </div>
      <div className="corner-hand">
        {n === 0 ? (
          <span />
        ) : (
          player.hand.map((card, i) => {
            const isFocused = focusedCardId === card.id;
            // Spread cards evenly across the container width using CSS calc.
            // As n grows the step shrinks → overlap increases, no scroll needed.
            const left = n === 1
              ? `calc(50% - ${CARD_W / 2}px)`
              : `calc((100% - ${CARD_W}px) * ${i / (n - 1)})`;
            return (
              <div
                key={card.id}
                className={`fan-card-wrap${isFocused ? ' fan-focused' : ''}${pendingDiscard && !selectedCardIds.includes(card.id) ? ' fan-card-dim' : ''}${pendingDiscard && !selectedCardIds.includes(card.id) && selectedCardIds.length >= (pendingDiscardCount ?? 0) ? ' fan-card-blocked' : ''}`}
                style={{
                  left,
                  zIndex: isFocused ? 30 : selectedCardIds.includes(card.id) ? 20 : i + 1,
                }}
              >
                <CardDisplay
                  card={card}
                  isSelected={selectedCardIds.includes(card.id)}
                  onClick={() => {
                    setFocusedCardId(focusedCardId === card.id ? null : card.id);
                    onCardClick(card);
                  }}
                  disabled={!isActive}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Board phase action button — reflects the incident's resolved effect ────

function boardPhaseActionLabel(resolved: ResolvedIncident | null): string {
  if (!resolved || !resolved.effectSummary) return 'Place Device';
  const deviceMatch = resolved.effectSummary.match(/\+(\d+) device/);
  if (deviceMatch) {
    const n = parseInt(deviceMatch[1], 10);
    return `Place ${n} Device${n > 1 ? 's' : ''}`;
  }
  const trustMatch = resolved.effectSummary.match(/([+-])(\d+) trust/);
  if (trustMatch) {
    const [, sign, amount] = trustMatch;
    return sign === '+' ? `Raise Trust Meter by ${amount}` : `Decrease Trust Meter by ${amount}`;
  }
  return 'Continue';
}

// ── Surveillance incident overlay ──────────────────────────────────────────

function IncidentOverlay({
  incident,
  dispatch,
  facesTop,
}: {
  incident: import('./types/game').PendingIncident;
  dispatch: (a: GameAction) => void;
  facesTop?: boolean;
}) {
  return (
    <div className="incident-overlay">
      <div className="incident-flash" />
      <div className={facesTop ? 'incident-card-rotated' : ''}>
      <div className="incident-card">
        {/* Card header band */}
        <div className="incident-card-header">
          <span className="incident-card-type-label">SURVEILLANCE INCIDENT</span>
        </div>

        {/* Art zone */}
        <div className="incident-card-art">
          <img src={asset('/warning.png')} alt="" className="incident-card-art-icon" />
        </div>

        {/* Inner frame body */}
        <div className="incident-card-body">
          <div className="incident-card-name">{incident.card.name}</div>
          <div className="incident-card-flavor">{incident.card.educationalNote}</div>
          <div className="incident-card-rule">{incident.card.effect}</div>

        </div>

        {/* Action footer */}
        <div className="incident-card-footer">
          <button className="btn incident-card-btn incident-btn-support"
            onClick={() => dispatch({ type: 'INCIDENT_VOTE', choice: 'support' })}>
            Support
          </button>
          <button className="btn incident-card-btn incident-btn-pushback"
            onClick={() => dispatch({ type: 'INCIDENT_VOTE', choice: 'pushback' })}>
            Push Back
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

// ── Turn action popup ───────────────────────────────────────────────────────

function TurnPopup({
  position,
  roleId,
  state,
  selectedCardIds,
  selectedNeighborhood,
  selectedSlot,
  dispatch,
  onClearSelection,
}: {
  position: 'bl' | 'br' | 'tl' | 'tr';
  roleId: string;
  state: GameState;
  selectedCardIds: string[];
  selectedNeighborhood: NeighborhoodId | null;
  selectedSlot: SlotIndex | null;
  dispatch: (action: GameAction) => void;
  onClearSelection: () => void;
}) {
  const activeRole = state.players[state.currentPlayerIndex]?.role.id;
  const isActive = activeRole === roleId && state.phase !== 'won' && state.phase !== 'lost';
  const [show, setShow] = useState(isActive);
  const [anim, setAnim] = useState<'popup-enter' | 'popup-exit'>(isActive ? 'popup-enter' : 'popup-exit');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isActive) {
      setShow(true);
      setAnim('popup-enter');
    } else {
      setAnim('popup-exit');
      timerRef.current = setTimeout(() => setShow(false), 400);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isActive]);

  if (!show) return null;
  const isTop = position === 'tl' || position === 'tr';

  return (
    <div className={`turn-popup turn-popup-${position} ${anim}`}>
      <div className={`popup-inner${isTop ? ' popup-inner-rotated' : ''}`}>
        <ActionPanel
          state={state}
          selectedCardIds={selectedCardIds}
          selectedNeighborhood={selectedNeighborhood}
          selectedSlot={selectedSlot}
          dispatch={dispatch}
          onClearSelection={onClearSelection}
        />
      </div>
    </div>
  );
}

// ── Game screen ────────────────────────────────────────────────────────────

interface GameScreenProps {
  playerCount: 2 | 3 | 4;
  onRestart: () => void;
  onNewGame: () => void;
}

function GameScreen({ playerCount, onRestart, onNewGame }: GameScreenProps) {
  const [state, dispatch] = useReducer(gameReducer, playerCount, buildInitialState);

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodId | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotIndex | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState<'top' | 'bottom' | null>(null);
  const [rotatedOverlay, setRotatedOverlay] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [flashTarget, setFlashTarget] = useState<{ neighborhood: string; slot: number } | null>(null);
  // Intro story — shown once when a fresh game mounts, before Round 1.
  const [showIntro, setShowIntro] = useState(true);

  // Auto-fit the board into the vertical band BETWEEN the top trackers and the
  // bottom trackers, centered in that band, scaling up to fill large TV/TUI
  // screens without overlapping either tracker.
  const boardZoneRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const zone = boardZoneRef.current;
    const area = boardAreaRef.current;
    if (!zone || !area) return;
    const grid = area.querySelector('.board-grid') as HTMLElement | null;
    const fit = () => {
      if (!grid) return;
      area.style.transform = 'none';                  // reset to measure natural size
      const naturalW = grid.offsetWidth;
      // Houses/landmark are absolutely positioned and overflow the grid box,
      // so pad the measured height to avoid under-scaling.
      const naturalH = grid.offsetHeight + 56;
      if (!naturalW || !naturalH) return;
      const zoneRect = zone.getBoundingClientRect();
      const zoneCenterY = zoneRect.top + zoneRect.height / 2;
      const topEl = document.querySelector('.board-trackers-header') as HTMLElement | null;
      const bottomEl = document.querySelector('.board-trackers-bottom') as HTMLElement | null;
      const topLimit = topEl ? topEl.getBoundingClientRect().bottom : zoneRect.top;
      const bottomLimit = bottomEl ? bottomEl.getBoundingClientRect().top : zoneRect.bottom;
      const bandCenter = (topLimit + bottomLimit) / 2;
      const availH = (bottomLimit - topLimit) - 28;   // leave a margin off each tracker
      const availW = zoneRect.width - 24;
      const scale = Math.max(0.5, Math.min(2.6, availW / naturalW, availH / naturalH));
      const offsetY = bandCenter - zoneCenterY;        // center the board within the band
      area.style.transform = `translateY(${offsetY}px) scale(${scale})`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(zone);
    window.addEventListener('resize', fit);
    const t = setTimeout(fit, 300);                    // refit after fonts/sprites settle
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); clearTimeout(t); };
  }, []);

  const handleCardClick = useCallback((card: CommunityCard) => {
    setSelectedCardIds((prev) => {
      const isSelected = prev.includes(card.id);
      if (isSelected) return prev.filter((id) => id !== card.id);
      // Cap selection at discard count when a discard is pending
      const discardCount = state.pendingDiscard?.count;
      if (discardCount !== undefined && prev.length >= discardCount) return prev;
      return [...prev, card.id];
    });
  }, [state.pendingDiscard]);

  const handleNeighborhoodSelect = useCallback((id: NeighborhoodId) => {
    setSelectedNeighborhood((prev) => (prev === id ? null : id));
    setSelectedSlot(null);
  }, []);

  const handleSlotClick = useCallback((neighborhoodId: NeighborhoodId, slot: SlotIndex) => {
    setSelectedNeighborhood(neighborhoodId);
    setSelectedSlot((prev) => (prev === slot ? null : slot));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCardIds([]);
    setSelectedNeighborhood(null);
    setSelectedSlot(null);
  }, []);

  const handleMove = useCallback(
    (position: import('./types/game').Position) => {
      dispatch({ type: 'MOVE', to: position });
    },
    [dispatch]
  );

  const canMove =
    state.phase === 'player-turn' &&
    !state.pendingDiceRoll &&
    !state.pendingIncident &&
    state.actionsRemaining > 0;

  if (state.phase === 'won' || state.phase === 'lost') {
    return (
      <GameOver
        won={state.phase === 'won'}
        reason={state.lossReason}
        round={state.round}
        privacyMeter={state.privacyMeter}
        onRestart={onRestart}
      />
    );
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  const reachablePositions = canMove ? getReachablePositions(activePlayer.position) : [];
  const reachable = (pos: import('./types/game').Position) => reachablePositions.includes(pos);
  const facesTop = activePlayer.role.id === 'organizer' || activePlayer.role.id === 'captain';

  // Role → corner mapping
  const byRole = (id: string): Player | undefined =>
    state.players.find((p) => p.role.id === id);
  const organizerPlayer = byRole('organizer');
  const legalPlayer     = byRole('legal');
  const captainPlayer   = byRole('captain');
  const councilPlayer   = byRole('council');

  const isActive = (p?: Player) => !!p && p.id === activePlayer.id && !state.pendingDiceRoll;
  const hasMoved = (p?: Player) => !!p && p.id === activePlayer.id && state.actionsRemaining < (state.lastDiceRoll ?? state.actionsRemaining + 1);
  const selFor   = (p?: Player) => (isActive(p) ? selectedCardIds : []);
  const clickFor = (p?: Player) => (isActive(p) ? handleCardClick : () => {});

  return (
    <div className="tv-game">

      {/* ── TOP-LEFT: Community Organizer (rotated 180°) ─────── */}
      <div className="tv-corner corner-tl">
        {organizerPlayer ? (
          <CornerPanel
            player={organizerPlayer}
            isActive={isActive(organizerPlayer)}
            hasMoved={hasMoved(organizerPlayer)}
            selectedCardIds={selFor(organizerPlayer)}
            onCardClick={clickFor(organizerPlayer)}
            pendingDiscard={isActive(organizerPlayer) && !!state.pendingDiscard}
            pendingDiscardCount={state.pendingDiscard?.count}
          />
        ) : (
          <div className="corner-empty-slot">No player</div>
        )}
      </div>

      {/* ── LEFT SIDE: empty (log moved to top-bar button) ────── */}
      <div className="tv-pm side-tracker" />

      {/* ── TOP CENTER: Title bar + Revealed cards ────────────── */}
      <div className="tv-top-center">
        <div className="tv-top-bar-row">
          <div className="tv-top-bar">
            <PrivacyMeter value={state.privacyMeter} blocked={!!state.pendingIncident} />
          </div>
          <div className="settings-menu">
            <button
              className={`btn-quit ${showSettings === 'top' ? 'active' : ''}`}
              onClick={() => setShowSettings((s) => s === 'top' ? null : 'top')}
            >
              ⚙️
            </button>
            {showSettings === 'top' && (
              <div className="settings-dropdown">
                <button className="btn-quit" onClick={() => { setShowLog(true); setRotatedOverlay(true); setShowSettings(null); }}>Game Log</button>
                <button className="btn-quit" onClick={onNewGame}>New Game</button>
                <button className="btn-quit" onClick={() => { setShowRoles(true); setRotatedOverlay(true); setShowSettings(null); }}>Role</button>
                <button className="btn-quit" onClick={() => { setShowTutorial(true); setRotatedOverlay(true); setShowSettings(null); }}>Tutorial</button>
                <button className="btn-quit" onClick={onRestart}>Exit</button>
              </div>
            )}
          </div>
        </div>
        {/* Surveillance (density) tracker for the Activist & Parent players, rotated
           180° (see .board-trackers-header) so it faces their side of the table. */}
        <div className="board-trackers board-trackers-header">
          <DensityTracker value={state.densityTracker} vertical blocked={!!state.pendingIncident} round={state.round} />
        </div>
        <RevealedCards cards={state.revealedSurveillanceCards} />
      </div>

      {/* ── Game Log dropdown — one copy per side, both toggled by the Log button.
          Far copy (flipped, top) faces the Activist & Parent; near copy (upright,
          bottom) faces the Lawyer & City Council. ── */}
      {showLog && (
        <div className={`tutorial-overlay${rotatedOverlay ? ' overlay-rotated' : ''}`} onClick={() => setShowLog(false)}>
          <div className="role-overlay-panel" onClick={e => e.stopPropagation()}>
            <div className="tutorial-overlay-header">
              <span className="tutorial-overlay-title">Game Log</span>
              <button className="tutorial-overlay-close" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div className="log-round-badge">Round {state.round}</div>
            <GameLog log={state.gameLog} />
          </div>
        </div>
      )}

      {/* ── TOP-RIGHT: Neighborhood Captain (rotated 180°) ────── */}
      <div className="tv-corner corner-tr">
        {captainPlayer ? (
          <CornerPanel
            player={captainPlayer}
            isActive={isActive(captainPlayer)}
            hasMoved={hasMoved(captainPlayer)}
            selectedCardIds={selFor(captainPlayer)}
            onCardClick={clickFor(captainPlayer)}
            pendingDiscard={isActive(captainPlayer) && !!state.pendingDiscard}
          />
        ) : (
          <div className="corner-empty-slot">No player</div>
        )}
      </div>

      {/* ── CENTER BOARD ──────────────────────────────────────── */}
      <div className="tv-board-zone" ref={boardZoneRef}>
        <div className="board-area" ref={boardAreaRef}>
          <div className="board-grid">
            <div className="board-n1">
              <NeighborhoodTile
                neighborhood={state.neighborhoods[0]}
                players={state.players}
                isSelected={selectedNeighborhood === 'suburb'}
                onSelect={() => handleNeighborhoodSelect('suburb')}
                onSlotClick={(slot) => handleSlotClick('suburb', slot)}
                selectedSlot={selectedNeighborhood === 'suburb' ? selectedSlot : null}
                canMove={canMove}
                activePlayerPosition={activePlayer.position}
                activePlayerId={activePlayer.id}
                onMove={handleMove}
                flashSlot={flashTarget?.neighborhood === 'suburb' ? flashTarget.slot : null}
                facesTop={facesTop}
              />
            </div>

            <div className="board-roads-top">
              <div className="road-segment-v">
                <div className="road-line-v" />
                <div
                  className={`road-waypoint${activePlayer.position === 'suburb-road-1' ? ' active-player-here' : ''}${reachable('suburb-road-1') ? ' moveable' : ''}`}
                  onClick={() => { if (reachable('suburb-road-1')) handleMove('suburb-road-1'); }}
                >
                  {state.players.filter((p) => p.position === 'suburb-road-1').map((p) => (
                    <span key={p.id} className={p.id === activePlayer.id ? 'active-pawn' : ''} title={p.role.name}>
                      {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                    </span>
                  ))}
                </div>
                <div className="road-line-v" />
              </div>
            </div>

            <div className="board-middle">
              <NeighborhoodTile
                neighborhood={state.neighborhoods[1]}
                players={state.players}
                isSelected={selectedNeighborhood === 'courthouse'}
                onSelect={() => handleNeighborhoodSelect('courthouse')}
                onSlotClick={(slot) => handleSlotClick('courthouse', slot)}
                selectedSlot={selectedNeighborhood === 'courthouse' ? selectedSlot : null}
                canMove={canMove}
                activePlayerPosition={activePlayer.position}
                activePlayerId={activePlayer.id}
                onMove={handleMove}
                flashSlot={flashTarget?.neighborhood === 'courthouse' ? flashTarget.slot : null}
                facesTop={facesTop}
              />
              <div className="city-hall-area">
                <div className="ch-road-v" />
                <div className="city-hall-row">
                <div className="road-segment-h">
                  <div className="road-line-h" />
                  <div
                    className={`road-waypoint${activePlayer.position === 'courthouse-road-1' ? ' active-player-here' : ''}${reachable('courthouse-road-1') ? ' moveable' : ''}`}
                    onClick={() => { if (reachable('courthouse-road-1')) handleMove('courthouse-road-1'); }}
                  >
                    {state.players.filter((p) => p.position === 'courthouse-road-1').map((p) => (
                      <span key={p.id} className={p.id === activePlayer.id ? 'active-pawn' : ''} title={p.role.name}>
                        {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                      </span>
                    ))}
                  </div>
                  <div className="road-line-h" />
                </div>
                <div
                  className={`city-hall ${state.players.some((p) => p.position === 'city-hall') ? 'has-players' : ''} ${reachable('city-hall') ? 'moveable' : ''} ${activePlayer.position === 'city-hall' ? 'active-player-here' : ''}`}
                  onClick={() => { if (reachable('city-hall')) handleMove('city-hall'); }}
                >
                  <div className="town-square-icon" aria-hidden="true">⛲</div>
                  <div className="city-hall-label">TOWN SQUARE</div>
                  <div className="city-hall-sublabel">Deposit Zone</div>
                  <div className="city-hall-players">
                    {state.players.filter((p) => p.position === 'city-hall').map((p) => (
                      <span key={p.id} className={p.id === activePlayer.id ? 'active-pawn' : ''} title={p.role.name}>
                        {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="road-segment-h">
                  <div className="road-line-h" />
                  <div
                    className={`road-waypoint${activePlayer.position === 'media-road-1' ? ' active-player-here' : ''}${reachable('media-road-1') ? ' moveable' : ''}`}
                    onClick={() => { if (reachable('media-road-1')) handleMove('media-road-1'); }}
                  >
                    {state.players.filter((p) => p.position === 'media-road-1').map((p) => (
                      <span key={p.id} className={p.id === activePlayer.id ? 'active-pawn' : ''} title={p.role.name}>
                        {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                      </span>
                    ))}
                  </div>
                  <div className="road-line-h" />
                </div>
                </div>
                <div className="ch-road-v" />
              </div>
              <NeighborhoodTile
                neighborhood={state.neighborhoods[2]}
                players={state.players}
                isSelected={selectedNeighborhood === 'media'}
                onSelect={() => handleNeighborhoodSelect('media')}
                onSlotClick={(slot) => handleSlotClick('media', slot)}
                selectedSlot={selectedNeighborhood === 'media' ? selectedSlot : null}
                canMove={canMove}
                activePlayerPosition={activePlayer.position}
                activePlayerId={activePlayer.id}
                onMove={handleMove}
                flashSlot={flashTarget?.neighborhood === 'media' ? flashTarget.slot : null}
                facesTop={facesTop}
              />
            </div>

            <div className="board-roads-bottom">
              <div className="road-segment-v">
                <div className="road-line-v" />
                <div
                  className={`road-waypoint${activePlayer.position === 'politics-road-1' ? ' active-player-here' : ''}${reachable('politics-road-1') ? ' moveable' : ''}`}
                  onClick={() => { if (reachable('politics-road-1')) handleMove('politics-road-1'); }}
                >
                  {state.players.filter((p) => p.position === 'politics-road-1').map((p) => (
                    <span key={p.id} className={p.id === activePlayer.id ? 'active-pawn' : ''} title={p.role.name}>
                      {p.role.characterImage ? <img src={p.role.characterImage} alt={p.role.name} className="pawn-img" /> : p.role.emoji}
                    </span>
                  ))}
                </div>
                <div className="road-line-v" />
              </div>
            </div>

            <div className="board-n4">
              <NeighborhoodTile
                neighborhood={state.neighborhoods[3]}
                players={state.players}
                isSelected={selectedNeighborhood === 'politics'}
                onSelect={() => handleNeighborhoodSelect('politics')}
                onSlotClick={(slot) => handleSlotClick('politics', slot)}
                selectedSlot={selectedNeighborhood === 'politics' ? selectedSlot : null}
                canMove={canMove}
                activePlayerPosition={activePlayer.position}
                activePlayerId={activePlayer.id}
                onMove={handleMove}
                flashSlot={flashTarget?.neighborhood === 'politics' ? flashTarget.slot : null}
                facesTop={facesTop}
              />
            </div>
          </div>
        </div>

        {/* Near-side stack for the Lawyer & City Council players: the Surveillance
           tracker above an upright copy of the top bar (Privacy meter + Log /
           New Game) so they get the same controls facing their side of the table. */}
        <div className="tv-bottom-center">
<div className="board-trackers board-trackers-bottom">
            <DensityTracker value={state.densityTracker} vertical blocked={!!state.pendingIncident} round={state.round} />
          </div>
          <div className="tv-top-bar-row">
            <div className="tv-top-bar">
              <PrivacyMeter value={state.privacyMeter} blocked={!!state.pendingIncident} />
              </div>
            <div className="settings-menu">
              <button
                className={`btn-quit ${showSettings === 'bottom' ? 'active' : ''}`}
                onClick={() => setShowSettings((s) => s === 'bottom' ? null : 'bottom')}
              >
                ⚙️
              </button>
              {showSettings === 'bottom' && (
                <div className="settings-dropdown">
                  <button className="btn-quit" onClick={() => { setShowLog(true); setRotatedOverlay(false); setShowSettings(null); }}>Game Log</button>
                  <button className="btn-quit" onClick={onNewGame}>New Game</button>
                  <button className="btn-quit" onClick={() => { setShowRoles(true); setRotatedOverlay(false); setShowSettings(null); }}>Role</button>
                  <button className="btn-quit" onClick={() => { setShowTutorial(true); setRotatedOverlay(false); setShowSettings(null); }}>Tutorial</button>
                  <button className="btn-quit" onClick={onRestart}>Exit</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDE: (trackers moved to board edges) ───────── */}
      <div className="tv-dt side-tracker" />

      {/* ── BOTTOM-LEFT: Legal Advocate ───────────────────────── */}
      <div className="tv-corner corner-bl">
        {legalPlayer ? (
          <CornerPanel
            player={legalPlayer}
            isActive={isActive(legalPlayer)}
            hasMoved={hasMoved(legalPlayer)}
            selectedCardIds={selFor(legalPlayer)}
            onCardClick={clickFor(legalPlayer)}
            pendingDiscard={isActive(legalPlayer) && !!state.pendingDiscard}
          />
        ) : (
          <div className="corner-empty-slot">No player</div>
        )}
      </div>

      {/* ── BOTTOM-RIGHT: Council Member ──────────────────────── */}
      <div className="tv-corner corner-br">
        {councilPlayer ? (
          <CornerPanel
            player={councilPlayer}
            isActive={isActive(councilPlayer)}
            hasMoved={hasMoved(councilPlayer)}
            selectedCardIds={selFor(councilPlayer)}
            onCardClick={clickFor(councilPlayer)}
            pendingDiscard={isActive(councilPlayer) && !!state.pendingDiscard}
          />
        ) : (
          <div className="corner-empty-slot">No player</div>
        )}
      </div>

      {/* ── Per-player action popups ─────────────────────────── */}
      {organizerPlayer && (
        <TurnPopup position="tl" roleId="organizer" state={state}
          selectedCardIds={selFor(organizerPlayer)} selectedNeighborhood={selectedNeighborhood}
          selectedSlot={selectedSlot} dispatch={dispatch} onClearSelection={clearSelection} />
      )}
      {captainPlayer && (
        <TurnPopup position="tr" roleId="captain" state={state}
          selectedCardIds={selFor(captainPlayer)} selectedNeighborhood={selectedNeighborhood}
          selectedSlot={selectedSlot} dispatch={dispatch} onClearSelection={clearSelection} />
      )}
      {legalPlayer && (
        <TurnPopup position="bl" roleId="legal" state={state}
          selectedCardIds={selFor(legalPlayer)} selectedNeighborhood={selectedNeighborhood}
          selectedSlot={selectedSlot} dispatch={dispatch} onClearSelection={clearSelection} />
      )}
      {councilPlayer && (
        <TurnPopup position="br" roleId="council" state={state}
          selectedCardIds={selFor(councilPlayer)} selectedNeighborhood={selectedNeighborhood}
          selectedSlot={selectedSlot} dispatch={dispatch} onClearSelection={clearSelection} />
      )}

      {/* ── Center dice roll ─────────────────────────────────────── */}
      {state.phase === 'player-turn' && state.pendingDiceRoll && !state.pendingIncident && (
        <CenterDiceRoll state={state} dispatch={dispatch} />
      )}

      {/* ── In-game tutorial overlay ─────────────────────────────── */}
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} rotated={rotatedOverlay} />}

      {/* ── Role overview overlay ────────────────────────────────── */}
      {showRoles && <RoleOverlay state={state} onClose={() => setShowRoles(false)} rotated={rotatedOverlay} />}

      {/* ── Board phase overlay ──────────────────────────────── */}
      {state.phase === 'board-phase' && !state.pendingIncident && !flashTarget && (
        <div className="board-phase-overlay">
          <div className="board-phase-border">
          <div className="board-phase-card">
            <div className="board-phase-header">
              <span className="board-phase-header-label">BOARD PHASE</span>
            </div>
            <div className="board-phase-art">
              <img src={asset('/caution.png')} alt="" className="board-phase-art-icon" />
            </div>
            <div className="board-phase-body">
              {state.resolvedIncident && (
                <div className="board-phase-incident-reveal">
                  <div className="board-phase-incident-choice">
                    <div className="board-phase-incident-choice-label">Your community chose to:</div>
                    <div className="board-phase-incident-choice-value">
                      {state.resolvedIncident.choice === 'support' ? 'Support' : 'Push Back'}
                    </div>
                  </div>
                  <div className="board-phase-incident-text">
                    {state.resolvedIncident.text}
                  </div>
                </div>
              )}
              {!state.resolvedIncident && (
                <p className="board-phase-text">{getBoardPhaseEvent(state.round)}</p>
              )}
            </div>
            <div className="board-phase-footer">
              <button
                className="btn board-phase-btn"
                disabled={!!flashTarget}
                onClick={() => {
                  const willPlace = state.blockedBoardPhases === 0 && state.cancelNextSurveillance === 0 && state.surveillanceDeck.length > 0;
                  if (willPlace) {
                    const top = state.surveillanceDeck[0];
                    setFlashTarget({ neighborhood: top.neighborhood, slot: top.slot });
                    setTimeout(() => {
                      dispatch({ type: 'BOARD_PHASE' });
                      setFlashTarget(null);
                    }, 1500);
                  } else {
                    dispatch({ type: 'BOARD_PHASE' });
                  }
                }}
              >
                {flashTarget ? 'Placing...' : boardPhaseActionLabel(state.resolvedIncident)}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── Surveillance incident overlay — shown after drawn cards are confirmed ── */}
      {state.pendingIncident && !state.pendingDrawnCards && (
        <IncidentOverlay
          incident={state.pendingIncident}
          dispatch={dispatch}
          facesTop={['organizer', 'captain'].includes(state.pendingIncident.triggeredByRoleId ?? '')}
        />
      )}

      {/* ── Drawn cards popup overlay ─────────────────────────── */}
      {state.pendingDrawnCards && (() => {
        const drawingPlayer = state.players.find((p) => p.id === state.pendingDrawnCards!.playerId);
        // Top-corner players (organizer = TL, captain = TR) read upside-down,
        // so flip the popup to face them.
        const facesTop = drawingPlayer?.role.id === 'organizer' || drawingPlayer?.role.id === 'captain';
        return (
        <div className="drawn-cards-overlay">
          <div className={`drawn-cards-modal${facesTop ? ' drawn-cards-modal-rotated' : ''}`}>
            <div className="drawn-cards-header">
              <span className="drawn-cards-header-label">Cards Drawn</span>
            </div>
            <div className="drawn-cards-body">
              <div className="drawn-cards-list">
                {state.pendingDrawnCards.cards.map((card) => (
                  <div key={card.id} className={`drawn-card-wrap cat-wrap-${card.category}${card.isPowerUp ? ' drawn-card-powerup' : ''}`}>
                  <div className={`drawn-card`}>
                    <div className="drawn-card-header" style={{ background: DRAWN_CARD_COLORS[card.category] }}>
                      <span className="drawn-card-category">{DRAWN_CARD_LABELS[card.category]}</span>
                    </div>
                    <div className="drawn-card-art">
                      {DRAWN_CARD_ICON_IMAGES[card.category] ? (
                        <img src={asset(`/${DRAWN_CARD_ICON_IMAGES[card.category]}`)} alt="" className="drawn-card-art-icon" />
                      ) : (
                        <span className="drawn-card-art-icon">{DRAWN_CARD_ICONS[card.category]}</span>
                      )}
                    </div>
                    <div className="drawn-card-body">
                      <div className="drawn-card-name" style={{ color: DRAWN_CARD_COLORS[card.category] }}>{card.name}</div>
                      <div className="drawn-card-edu">{card.educationalContent}</div>
                      <div className="drawn-card-effect">{card.effect}</div>
                    </div>
                  </div>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary drawn-cards-confirm"
                onClick={() => dispatch({ type: 'ACKNOWLEDGE_DRAWN_CARDS' })}
              >
                Add to Hand
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── Intro story overlay (shown once at the start of a new game) ── */}
      {showIntro && (
        <div className="intro-overlay">
          <div className="intro-panel">
            <img src={asset('/letter.png')} alt="" className="intro-icon" />
            <p className="intro-salutation">Dear Maplewood,</p>
            <p className="intro-body">
              Something is changing in our neighborhood. You've seen the news. You've heard the
              debates. Each week brings a new proposal, a new device, a new reason to feel watched.
              As a parent, lawyer, council member, and advocate, we have a responsibility to get this
              right. Together.
            </p>
            <button className="intro-btn" onClick={() => setShowIntro(false)}>
              Start
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<{ count: 2 | 3 | 4; key: number } | null>(null);

  const handleStart = (count: 2 | 3 | 4) => {
    setSession((prev) => ({ count, key: (prev?.key ?? 0) + 1 }));
  };

  const handleRestart = () => setSession(null);
  const handleNewGame = () => setSession((prev) => prev ? { count: prev.count, key: prev.key + 1 } : null);

  if (!session) return <GameSetup onStart={handleStart} />;

  return <GameScreen key={session.key} playerCount={session.count} onRestart={handleRestart} onNewGame={handleNewGame} />;
}
