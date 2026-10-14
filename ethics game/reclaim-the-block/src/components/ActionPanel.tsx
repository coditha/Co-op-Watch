import { useState, useRef } from 'react';
import type { GameState, NeighborhoodId, SlotIndex } from '../types/game';
import type { GameAction } from '../store/gameReducer';

interface Props {
  state: GameState;
  selectedCardIds: string[];
  selectedNeighborhood: NeighborhoodId | null;
  selectedSlot: SlotIndex | null;
  dispatch: (action: GameAction) => void;
  onClearSelection: () => void;
}

interface ActionBtn {
  id: string;
  icon: string;
  label: string;
  tooltip: string;
  available: boolean;
  onTap: () => void;
}

const NHCOLOR: Record<string, string> = { suburb: 'yellow', courthouse: 'blue', media: 'green', politics: 'red' };

// Dice rendering & roll logic now live in CenterDiceRoll.tsx.

export default function ActionPanel({
  state, selectedCardIds, selectedNeighborhood, selectedSlot, dispatch, onClearSelection,
}: Props) {
  const { phase, actionsRemaining, currentPlayerIndex, players, pendingIncident, pendingDiscard } = state;
  const player = players[currentPlayerIndex];
  const actions = actionsRemaining;

  // ── Transfer Card picker state ─────────────────────────────────────────
  const [shareStep, setShareStep] = useState<'idle' | 'pick-player' | 'pick-card'>('idle');
  const [shareTargetId, setShareTargetId] = useState<number | null>(null);

  // ── Hold-for-tooltip state ───────────────────────────────────────────────
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipShown = useRef(false);

  function startHold(id: string) {
    tooltipShown.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      tooltipShown.current = true;
      setActiveTooltip(id);
    }, 380);
  }

  function endHold() {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    setActiveTooltip(null);
    // reset on next frame so the onClick check still sees the old value
    requestAnimationFrame(() => { tooltipShown.current = false; });
  }

  // ── Action availability ──────────────────────────────────────────────────
  const canAct = phase === 'player-turn' && actions > 0 && !pendingIncident;
  const selectedCards = player.hand.filter((c) => selectedCardIds.includes(c.id));

  // Auto-derive slot/neighborhood from player's current position (e.g. "suburb-n2")
  const SLOT_INDEX: Record<string, SlotIndex> = { n1: 0, n2: 1, n3: 2, n4: 3 };
  const posMatch = player.position.match(/^([a-z-]+)-(n[1-4])$/);
  const autoNeighborhood = posMatch ? posMatch[1] as NeighborhoodId : null;
  const autoSlot = posMatch ? SLOT_INDEX[posMatch[2]] : null;
  const effectiveNeighborhood = selectedNeighborhood ?? autoNeighborhood;
  const effectiveSlot = selectedSlot !== null ? selectedSlot : autoSlot;
  const twoSameColor = selectedCards.length >= 2 && selectedCards[0].category === selectedCards[1].category;
  const cardsMatchNeighborhood =
    effectiveNeighborhood !== null &&
    selectedCards.length >= 2 &&
    selectedCards[0].category === NHCOLOR[effectiveNeighborhood];
  const playerInSelectedNeighborhood =
    effectiveNeighborhood !== null &&
    (player.position === effectiveNeighborhood || player.position.startsWith(`${effectiveNeighborhood}-n`));

  const canRemove =
    canAct && playerInSelectedNeighborhood && effectiveSlot !== null && effectiveNeighborhood !== null &&
    twoSameColor && cardsMatchNeighborhood &&
    state.neighborhoods.find((n) => n.id === effectiveNeighborhood)?.slots[effectiveSlot] !== null;

  const depositRequired = state.reducedNextDeposit ? 2 : 4;
  // Pick the best subset: one card per unique color, wildcards fill remaining slots
  const depositColorMap = new Map<string, string>(); // category → cardId
  const depositWildcardIds: string[] = [];
  for (const card of selectedCards) {
    if (card.effectType === 'wildcard-deposit') {
      depositWildcardIds.push(card.id);
    } else if (!depositColorMap.has(card.category)) {
      depositColorMap.set(card.category, card.id);
    }
  }
  const bestDepositIds = [
    ...depositColorMap.values(),
    ...depositWildcardIds,
  ].slice(0, depositRequired);
  const canDeposit =
    canAct && player.position === 'city-hall' &&
    bestDepositIds.length >= depositRequired;

  const colocatedPlayers = players.filter((p) => p.id !== player.id && p.position === player.position);
  const canShare = canAct && colocatedPlayers.length > 0 && player.hand.length > 0;

  // ── Action button definitions ────────────────────────────────────────────
  const nhColorNeeded = selectedNeighborhood ? NHCOLOR[selectedNeighborhood] : null;

  const actionButtons: ActionBtn[] = [
    {
      id: 'remove',
      icon: '🗑️',
      label: 'Remove Device',
      tooltip: [
        'Cost: 1 action + 2 matching-color cards.',
        'You must be inside the neighborhood.',
        'Color key:',
        'Neighborhood → yellow   Courthouse → blue',
        'Media → green     Politics → red',
        nhColorNeeded
          ? `Currently need: 2 ${nhColorNeeded} cards.`
          : 'Select a neighborhood + device slot first.',
      ].join('\n'),
      available: canRemove,
      onTap: () => {
        dispatch({
          type: 'REMOVE_DEVICE',
          neighborhoodId: effectiveNeighborhood!,
          slotIndex: effectiveSlot!,
          cardIds: [selectedCardIds[0], selectedCardIds[1]] as [string, string],
        });
        onClearSelection();
      },
    },
    {
      id: 'deposit',
      icon: '🏛️',
      label: 'Deposit Cards',
      tooltip: [
        `Cost: 1 action + ${depositRequired} unique-color cards.`,
        'Must be at the Town Square.',
        'Need one of each: blue · yellow · green · red.',
        'Raises the Privacy & Community Trust Meter.',
      ].filter(Boolean).join('\n'),
      available: canDeposit,
      onTap: () => {
        dispatch({ type: 'DEPOSIT_AT_CITY_HALL', cardIds: bestDepositIds });
        onClearSelection();
      },
    },
    {
      id: 'share',
      icon: '🤝',
      label: 'Transfer Card',
      tooltip: [
        'Cost: 1 action.',
        'Give 1 Community Card to a teammate on your tile.',
        'Both players must occupy the exact same space.',
      ].join('\n'),
      available: canShare,
      onTap: () => setShareStep('pick-player'),
    },
  ];

  // Tooltip lookup including End Turn
  const tooltipMap: Record<string, { icon: string; label: string; tooltip: string }> = {};
  actionButtons.forEach((b) => { tooltipMap[b.id] = b; });
  tooltipMap['endturn'] = {
    icon: '✅',
    label: 'End Turn',
    tooltip: 'Draw 2 community cards and pass the turn.\nNo action cost — always available.',
  };

  const tooltipEntry = activeTooltip ? tooltipMap[activeTooltip] : null;

  return (
    <div className="ap-wrap">

      {/* ── Action tracker (panel header removed — player identified by color/corner) ── */}
      {phase === 'player-turn' && !state.pendingDiceRoll && !pendingIncident && !pendingDiscard && (() => {
        const total = Math.max(state.lastDiceRoll ?? actions, actions);
        return (
          <div className="ap-action-tracker">
            <div className="ap-action-count">
              <span className="ap-action-num">{actions}</span>
              <span className="ap-action-sep"> / {total} Actions Remaining</span>
            </div>
          </div>
        );
      })()}

      {/* Incident is now handled by the full-screen overlay in App.tsx */}

      {/* ── Hand limit discard ──────────────────────────────── */}
      {pendingDiscard && (
        <div className="ap-incident">
          <div className="ap-incident-title">Hand Limit Exceeded</div>
          <div className="ap-incident-effect">
            Remove {pendingDiscard.count} card{pendingDiscard.count > 1 ? 's' : ''} to not exceed max 7 hand limit.
            ({selectedCardIds.length}/{pendingDiscard.count} selected)
          </div>
          <button className="btn btn-danger"
            disabled={selectedCardIds.length !== pendingDiscard.count}
            onClick={() => { dispatch({ type: 'DISCARD_TO_HAND_LIMIT', cardIds: selectedCardIds }); onClearSelection(); }}>
            Confirm Discard
          </button>
        </div>
      )}



      {/* ── Action grid / Transfer Card picker ───────────────── */}
      {phase === 'player-turn' && !state.pendingDiceRoll && !pendingIncident && !pendingDiscard && (
        <div className="ap-body">

          {shareStep !== 'idle' ? (
            /* ── Transfer Card multi-step picker ── */
            <div className="ap-share-picker">
              {shareStep === 'pick-player' ? (
                <>
                  <div className="ap-share-title">Who to transfer a card to?</div>
                  {colocatedPlayers.map((p) => (
                    <button
                      key={p.id}
                      className="ap-share-option"
                      style={{ borderColor: p.role.colorHex }}
                      onClick={() => { setShareTargetId(p.id); setShareStep('pick-card'); }}
                    >
                      {p.role.emoji} {p.role.name}
                    </button>
                  ))}
                  <button className="ap-share-cancel ap-share-cancel-green" onClick={() => setShareStep('idle')}>Cancel</button>
                </>
              ) : (
                <>
                  <div className="ap-share-title">Which card to give?</div>
                  {player.hand.map((card) => (
                    <button
                      key={card.id}
                      className="ap-share-option"
                      onClick={() => {
                        dispatch({ type: 'TRANSFER_CARD', fromPlayerId: player.id, toPlayerId: shareTargetId!, cardId: card.id });
                        setShareStep('idle');
                        setShareTargetId(null);
                      }}
                    >
                      <span className={`card-dot cat-${card.category}`} /> {card.name}
                    </button>
                  ))}
                  <button className="ap-share-cancel ap-share-cancel-green" onClick={() => { setShareStep('pick-player'); setShareTargetId(null); }}>Back</button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Layer 2: tooltip (shown while holding any button) */}
              {tooltipEntry && (
                <div className="ap-tooltip">
                  <div className="ap-tooltip-title">{tooltipEntry.icon} {tooltipEntry.label}</div>
                  {tooltipEntry.tooltip.split('\n').map((line, i) => (
                    <div key={i} className="ap-tooltip-line">{line || <>&nbsp;</>}</div>
                  ))}
                </div>
              )}

              {/* Layer 1: action button grid */}
              <div className="ap-grid">
                {actionButtons.map((btn) => (
                  <button
                    key={btn.id}
                    className={`ap-action-btn${btn.available ? '' : ' ap-disabled'}`}
                    onPointerDown={() => startHold(btn.id)}
                    onPointerUp={endHold}
                    onPointerLeave={endHold}
                    onPointerCancel={endHold}
                    onClick={() => { if (!tooltipShown.current && btn.available) btn.onTap(); }}
                  >
                    <span className="ap-btn-label">{btn.label}</span>
                  </button>
                ))}
              </div>

              {/* End Turn — always last, largest button */}
              <button
                className="ap-end-turn"
                onPointerDown={() => startHold('endturn')}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onClick={() => { if (!tooltipShown.current) { dispatch({ type: 'END_TURN' }); onClearSelection(); } }}
              >
                End Turn
                <span className="ap-end-sub">DRAW 2 CARDS</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
