import type {
  GameState,
  CommunityCard,
  IncidentCard,
  IncidentOutcome,
  Card,
  NeighborhoodId,
  DeviceType,
  SlotIndex,
  Position,
  RoleId,
} from '../types/game';
import { COMMUNITY_CARDS } from '../data/cards';
import { SURVEILLANCE_CARDS } from '../data/surveillanceCards';
import { ROLES } from '../data/roles';
import { getIncidentForRound } from '../data/roundConfig';

const MAX_ROUNDS = 8;

// ── Utilities ──────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function neighborhoodIndex(id: NeighborhoodId): number {
  return ['suburb', 'courthouse', 'media', 'politics'].indexOf(id);
}

function deviceForTracker(tracker: number): DeviceType {
  if (tracker <= 2) return 'ring';
  if (tracker <= 4) return 'smart-speaker';
  if (tracker <= 6) return 'traffic-camera';
  return 'flock-reader';
}

function meterShiftForDevice(device: DeviceType): number {
  if (device === 'ring' || device === 'smart-speaker') return -1;
  if (device === 'traffic-camera') return -2;
  return -3; // flock-reader
}

function deviceEmoji(device: DeviceType): string {
  if (device === 'ring') return '📷';
  if (device === 'smart-speaker') return '🔊';
  if (device === 'traffic-camera') return '🚦';
  return '🚗';
}

function log(state: GameState, msg: string): GameState {
  return { ...state, gameLog: [msg, ...state.gameLog.slice(0, 49)] };
}

function shiftMeter(state: GameState, delta: number, reason: string): GameState {
  const newVal = clamp(state.privacyMeter + delta, 0, 30);
  const s = { ...state, privacyMeter: newVal };
  const sign = delta > 0 ? `+${delta}` : `${delta}`;
  return log(s, `Meter ${sign} (${reason}) → ${newVal}`);
}

function buildCommunityDeck(): Card[] {
  return shuffle([...COMMUNITY_CARDS]);
}

// Slot adjacency within a neighborhood: N1(0) N2(1) N3(2) N4(3)
// 0↔1, 0↔2, 1↔3, 2↔3  (corners of a 2×2 grid)
function adjacentSlots(slot: SlotIndex): SlotIndex[] {
  const adj: Record<SlotIndex, SlotIndex[]> = {
    0: [1, 2],
    1: [0, 3],
    2: [0, 3],
    3: [1, 2],
  };
  return adj[slot];
}

// Linear adjacency graph: city-hall ↔ road-1 ↔ road-2 ↔ n1 ↔ nr1 ↔ n2 ↔ nr2 ↔ n3 ↔ nr3 ↔ n4
// Each move covers exactly one step; players must traverse roads between slots.
export function getReachablePositions(from: Position): Position[] {
  const neighborhoods = ['suburb', 'courthouse', 'media', 'politics'] as const;

  if (from === 'city-hall') {
    return ['suburb-road-1', 'courthouse-road-1', 'media-road-1', 'politics-road-1'] as Position[];
  }

  for (const nh of neighborhoods) {
    // The City-Hall road connects to the device slot facing city-hall (the slot the
    // connecting road is drawn from): suburb=n4(bottom), courthouse=n2(right),
    // media=n3(left), politics=n1(top). That slot can step straight onto the road.
    const exitSlot: Record<string, string> = { suburb: 'n4', courthouse: 'n2', media: 'n3', politics: 'n1' };
    const exit = exitSlot[nh];
    if (from === (`${nh}-road-1` as Position)) return ['city-hall', `${nh}-${exit}`] as Position[];
    const roadFrom = (slot: string) => (exit === slot ? [`${nh}-road-1`] : []);
    // Square ring: nr1=top(n1↔n2), nr2=right(n2↔n4), nr3=bottom(n3↔n4), nr4=left(n1↔n3).
    // The city-hall-facing slot also links directly to road-1.
    if (from === (`${nh}-n1` as Position))  return [...roadFrom('n1'), `${nh}-nr1`, `${nh}-nr4`] as Position[];
    if (from === (`${nh}-n2` as Position))  return [...roadFrom('n2'), `${nh}-nr1`, `${nh}-nr2`] as Position[];
    if (from === (`${nh}-n3` as Position))  return [...roadFrom('n3'), `${nh}-nr4`, `${nh}-nr3`] as Position[];
    if (from === (`${nh}-n4` as Position))  return [...roadFrom('n4'), `${nh}-nr2`, `${nh}-nr3`] as Position[];
    if (from === (`${nh}-nr1` as Position)) return [`${nh}-n1`, `${nh}-n2`] as Position[];
    if (from === (`${nh}-nr2` as Position)) return [`${nh}-n2`, `${nh}-n4`] as Position[];
    if (from === (`${nh}-nr3` as Position)) return [`${nh}-n3`, `${nh}-n4`] as Position[];
    if (from === (`${nh}-nr4` as Position)) return [`${nh}-n1`, `${nh}-n3`] as Position[];
    // Legacy neighborhood-center position
    if (from === (nh as Position)) return [`${nh}-n1`, `${nh}-road-1`] as Position[];
  }

  return [];
}

// ── Initial State ──────────────────────────────────────────────────────────

export function buildInitialState(playerCount: 2 | 3 | 4): GameState {
  const roles = ROLES.slice(0, playerCount);
  const players = roles.map((role, i) => ({
    id: i,
    role,
    position: `${role.homeNeighborhood}-n1` as Position, // updated: players start at N1 of home neighborhood
    hand: [] as CommunityCard[],
    hasUsedSpecialAbilityThisTurn: false,
  }));

  const communityDeck = buildCommunityDeck();

  // Deal 4 starting cards each
  let deck = [...communityDeck];
  const dealtPlayers = players.map((p) => {
    const hand: CommunityCard[] = [];
    while (hand.length < 4 && deck.length > 0) {
      const card = deck.shift()!;
      if (card.type === 'community') hand.push(card);
      else deck.push(card); // put incident back at end
    }
    return { ...p, hand };
  });

  // Randomly place 4 starting ring devices; skip slot 0 (N1) because all players start there
  const eligibleSlots: { nhIdx: number; slot: SlotIndex }[] = [];
  for (let nhIdx = 0; nhIdx < 4; nhIdx++) {
    for (let slot = 1; slot <= 3; slot++) {
      eligibleSlots.push({ nhIdx, slot: slot as SlotIndex });
    }
  }
  const startingPlacements = shuffle(eligibleSlots).slice(0, 4);

  const NEIGHBORHOOD_DEFS = [
    { id: 'suburb' as NeighborhoodId, name: 'Neighborhood' },
    { id: 'courthouse' as NeighborhoodId, name: 'Courthouse' },
    { id: 'media' as NeighborhoodId, name: 'Downtown' },
    { id: 'politics' as NeighborhoodId, name: 'Civic Center' },
  ];
  const neighborhoods = NEIGHBORHOOD_DEFS.map((def, nhIdx) => {
    const slots: (DeviceType | null)[] = [null, null, null, null];
    startingPlacements.filter((p) => p.nhIdx === nhIdx).forEach((p) => { slots[p.slot] = 'ring'; });
    return { ...def, slots, densityTrack: slots.filter(Boolean).length };
  });

  return {
    phase: 'player-turn',
    round: 1,
    currentPlayerIndex: 0,
    actionsRemaining: 0,

    privacyMeter: 20,
    densityTracker: 1,

    neighborhoods,
    players: dealtPlayers,

    communityDeck: deck,
    communityDiscard: [],
    surveillanceDeck: shuffle([...SURVEILLANCE_CARDS]),
    surveillanceDiscard: [],

    revealedSurveillanceCards: [],

    pendingIncident: null,
    pendingDeferredIncident: null,
    resolvedIncident: null,
    pendingDrawnCards: null,
    pendingDiscard: null,

    blockedBoardPhases: 0,
    reducedBoardPhaseRounds: 0,
    reducedNextDeposit: false,
    cancelNextSurveillance: 0,
    cancelNextIncident: false,
    pendingExtraActions: 0,

    pendingDiceRoll: true,
    lastDiceRoll: null,

    incidentFiredThisRound: false,

    gameLog: ['Game started! Good luck reclaiming the block.'],
    lossReason: undefined,
  };
}

// ── Action Types ──────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'ROLL_DIE'; precomputedRoll?: number }
  | { type: 'MOVE'; to: Position }
  | { type: 'REMOVE_DEVICE'; neighborhoodId: NeighborhoodId; slotIndex: SlotIndex; cardIds: [string, string] }
  | { type: 'LEGAL_REMOVE_DEVICE'; neighborhoodId: NeighborhoodId; slotIndex: SlotIndex; cardIds: [string, string] }
  | { type: 'CAPTAIN_REVERSE_OVERFLOW'; cardIds: [string, string] }
  | { type: 'SWAP_CARDS'; withPlayerId: number; giveCardIds: string[]; takeCardIds: string[] }
  | { type: 'SHARE_KNOWLEDGE'; fromPlayerId: number; toPlayerId: number; cardId: string }
  | { type: 'PLAY_CARD'; cardId: string; targetNeighborhoodId?: NeighborhoodId; targetSlotIndex?: SlotIndex; targetPlayerId?: number; chosenPosition?: Position }
  | { type: 'DEPOSIT_AT_CITY_HALL'; cardIds: string[] }
  | { type: 'USE_SPECIAL_ABILITY'; targetNeighborhoodId?: NeighborhoodId; targetSlotIndex?: SlotIndex; revealCount?: number }
  | { type: 'END_TURN' }
  | { type: 'ACKNOWLEDGE_DRAWN_CARDS' }
  | { type: 'DISCARD_TO_HAND_LIMIT'; cardIds: string[] }
  | { type: 'BOARD_PHASE' }
  | { type: 'INCIDENT_VOTE'; choice: 'support' | 'pushback'; discardCardId?: string }
  | { type: 'DISCARD_CARD'; cardId: string };

// ── Helpers ───────────────────────────────────────────────────────────────

// Like drawCommunityCards but returns community cards separately instead of adding to hand.
// Incidents are still resolved normally (set pendingIncident).
function peekDrawCards(state: GameState, count: number): { state: GameState; drawnCards: CommunityCard[] } {
  let s = { ...state };
  let deck = [...s.communityDeck];
  let discard = [...s.communityDiscard];
  let deferredIncident: IncidentCard | null = null;
  const drawnCards: CommunityCard[] = [];

  let communityDrawn = 0;
  const maxIterations = count + 20;
  let iterations = 0;
  while (communityDrawn < count && iterations < maxIterations) {
    iterations++;
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
      s = log(s, 'Community deck reshuffled from discard.');
    }
    const card = deck.shift()!;
    if (card.type === 'incident') {
      discard.push(card);
      if (s.cancelNextIncident) {
        s = { ...s, cancelNextIncident: false };
        s = log(s, `Incident "${card.name}" cancelled by Class Action.`);
      } else if (!deferredIncident) {
        deferredIncident = card as IncidentCard;
      }
    } else {
      drawnCards.push(card as CommunityCard);
      communityDrawn++;
    }
  }

  s = { ...s, communityDeck: deck, communityDiscard: discard };

  if (deferredIncident) {
    s = shiftMeter(s, -1, `Incident card drawn: ${deferredIncident.name}`);
    s = { ...s, pendingIncident: { card: deferredIncident, triggeredByRoleId: s.players[s.currentPlayerIndex]?.role.id } };
    s = log(s, `⚠️ INCIDENT: ${deferredIncident.name}`);
  }

  return { state: s, drawnCards };
}

function drawCommunityCards(state: GameState, playerId: number, count: number, defer = false, noIncident = false): GameState {
  let s = { ...state };
  let deck = [...s.communityDeck];
  let discard = [...s.communityDiscard];
  let deferredIncident: IncidentCard | null = null;

  let communityDrawn = 0;
  const maxIterations = count + 20;
  let iterations = 0;
  while (communityDrawn < count && iterations < maxIterations) {
    iterations++;
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
      s = log(s, 'Community deck reshuffled from discard.');
    }
    const card = deck.shift()!;
    if (card.type === 'incident') {
      discard.push(card);
      if (noIncident) {
        // Special ability draws skip incidents entirely
      } else if (s.cancelNextIncident) {
        s = { ...s, cancelNextIncident: false };
        s = log(s, `Incident "${card.name}" cancelled by Class Action.`);
      } else if (!deferredIncident) {
        // Defer so the player finishes drawing their remaining cards first
        deferredIncident = card as IncidentCard;
      }
    } else {
      const players = s.players.map((p) =>
        p.id === playerId ? { ...p, hand: [...p.hand, card as CommunityCard] } : p
      );
      s = { ...s, players };
      communityDrawn++;
    }
  }

  s = { ...s, communityDeck: deck, communityDiscard: discard };

  if (deferredIncident) {
    s = shiftMeter(s, -1, `Incident card drawn: ${deferredIncident.name}`);
    const incident = { card: deferredIncident, triggeredByRoleId: s.players[s.currentPlayerIndex]?.role.id };
    if (defer) {
      s = { ...s, pendingDeferredIncident: incident };
    } else {
      s = { ...s, pendingIncident: incident };
    }
    s = log(s, `⚠️ INCIDENT: ${deferredIncident.name}`);
  }

  return s;
}

function drawCommunityCardsForAll(state: GameState, count: number, defer = false, noIncident = false): GameState {
  let s = state;
  for (const player of s.players) {
    s = drawCommunityCards(s, player.id, count, defer, noIncident);
  }
  return s;
}

function removeCardFromHand(state: GameState, playerId: number, cardIds: string[]): GameState {
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const hand = p.hand.filter((c) => !cardIds.includes(c.id));
    return { ...p, hand };
  });
  const removed = state.players.find((p) => p.id === playerId)?.hand.filter((c) => cardIds.includes(c.id)) ?? [];
  return { ...state, players, communityDiscard: [...state.communityDiscard, ...removed] };
}

// If the player exceeds the 7-card hand limit, return state with a manual discard
// prompt set; otherwise return null (no discard needed). Never discards automatically.
// advanceAfter=true ends the turn once resolved (end-of-turn draw); false keeps the
// turn going (mid-turn draw effects).
function enforceHandLimit(state: GameState, playerId: number, advanceAfter: boolean): GameState | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand.length <= 7) return null;
  const count = player.hand.length - 7;
  const s = log(state, `${player.role.name} must choose ${count} card(s) to discard (7-card hand limit).`);
  return { ...s, pendingDiscard: { playerId, count, advanceAfter } };
}

function removeDeviceFromSlot(
  state: GameState,
  neighborhoodId: NeighborhoodId,
  slotIndex: SlotIndex
): GameState {
  const neighborhoods = state.neighborhoods.map((n) => {
    if (n.id !== neighborhoodId) return n;
    const slots = [...n.slots] as (DeviceType | null)[];
    slots[slotIndex] = null;
    const densityTrack = Math.max(0, slots.filter(Boolean).length);
    return { ...n, slots, densityTrack };
  });
  return { ...state, neighborhoods };
}

function spendActions(state: GameState, count: number): GameState {
  return { ...state, actionsRemaining: state.actionsRemaining - count };
}

function placeDevice(
  state: GameState,
  neighborhoodId: NeighborhoodId,
  slotIndex: SlotIndex,
  device: DeviceType
): GameState {
  let s = { ...state };
  const nIdx = neighborhoodIndex(neighborhoodId);
  const n = s.neighborhoods[nIdx];

  if (n.slots[slotIndex] !== null) {
    // Slot already full — skip
    return log(s, `Slot ${slotIndex + 1} in ${n.name} already occupied, device skipped.`);
  }

  const slots = [...n.slots] as (DeviceType | null)[];
  slots[slotIndex] = device;
  const densityTrack = slots.filter(Boolean).length;

  s = {
    ...s,
    neighborhoods: s.neighborhoods.map((nb, i) =>
      i === nIdx ? { ...nb, slots, densityTrack } : nb
    ),
  };

  // Meter shift for device type
  const deviceShift = meterShiftForDevice(device);
  s = shiftMeter(s, deviceShift, `${deviceEmoji(device)} placed in ${n.name}`);

  if (densityTrack === 4) {
    s = { ...s, densityTracker: Math.min(8, s.densityTracker + 1) };
    s = log(s, `Density Tracker increased to ${s.densityTracker}`);
  }

  // Flock reader bleed
  if (device === 'flock-reader') {
    // Also affect adjacent slots within neighborhood
    const adjSlots = adjacentSlots(slotIndex as SlotIndex);
    for (const adj of adjSlots) {
      if (slots[adj] === null) {
        s = shiftMeter(s, -1, `Flock Reader radius affects slot ${adj + 1} in ${n.name}`);
      }
    }
    // Bleed to adjacent neighborhood on board (-1)
    s = shiftMeter(s, -1, `Flock Reader bleeds into adjacent neighborhood`);
  }

  return s;
}

// ── Incident Resolution ───────────────────────────────────────────────────

function summarizeIncidentOutcome(outcome: IncidentOutcome): string {
  const parts: string[] = [];
  if (outcome.deviceTarget) {
    const count = outcome.deviceCount ?? 1;
    parts.push(`+${count} device${count > 1 ? 's' : ''}`);
  }
  if (outcome.meterDelta) {
    parts.push(`${outcome.meterDelta > 0 ? '+' : ''}${outcome.meterDelta} trust`);
  }
  return parts.join(' · ');
}

function resolveIncident(state: GameState, incident: IncidentCard, choice: 'support' | 'pushback'): GameState {
  let s: GameState = { ...state, pendingIncident: null };
  const outcome = choice === 'support' ? incident.support : incident.pushBack;
  s = {
    ...s,
    resolvedIncident: {
      name: incident.name,
      choice,
      text: outcome.text,
      effectSummary: summarizeIncidentOutcome(outcome),
    },
  };
  s = log(s, `${incident.name} — ${choice === 'support' ? 'Support' : 'Push Back'}: ${outcome.text}`);

  // 1) Place devices (placeDevice applies its own per-device meter penalty).
  if (outcome.deviceTarget) {
    const targetIds: NeighborhoodId[] =
      outcome.deviceTarget === 'all'
        ? s.neighborhoods.map((n) => n.id)
        : [outcome.deviceTarget];
    const count = outcome.deviceCount ?? 1;
    for (const nId of targetIds) {
      for (let i = 0; i < count; i++) {
        const emptySlot = s.neighborhoods
          .find((n) => n.id === nId)!
          .slots.findIndex((sl) => sl === null);
        if (emptySlot === -1) break;
        s = placeDevice(s, nId, emptySlot as SlotIndex, deviceForTracker(s.densityTracker));
      }
    }
  }

  // 2) Apply the outcome's explicit meter change, if any.
  if (outcome.meterDelta) {
    s = shiftMeter(s, outcome.meterDelta, incident.name);
  }

  return s;
}

// ── Card Effect Application ───────────────────────────────────────────────

function applyCardEffect(
  state: GameState,
  card: CommunityCard,
  playerId: number,
  opts: {
    targetNeighborhoodId?: NeighborhoodId;
    targetSlotIndex?: SlotIndex;
    targetPlayerId?: number;
    chosenPosition?: Position;
  }
): GameState {
  let s = state;

  switch (card.effectType) {
    case 'meter-plus':
    case 'meter-plus-immediate':
      s = shiftMeter(s, card.effectValue ?? 1, card.name);
      break;

    case 'draw-cards':
      s = drawCommunityCards(s, playerId, card.effectValue ?? 1, true);
      break;

    case 'draw-cards-all':
    case 'draw-cards-swap':
      s = drawCommunityCardsForAll(s, card.effectValue ?? 1, true, true);
      break;

    case 'remove-device-own': {
      const player = s.players.find((p) => p.id === playerId)!;
      const home = s.neighborhoods.find((n) => n.id === player.role.homeNeighborhood)!;
      const count = card.effectValue ?? 1;
      let removed = 0;
      let tempS = s;
      for (let i = 0; i < 4 && removed < count; i++) {
        if (home.slots[i] !== null) {
          tempS = removeDeviceFromSlot(tempS, home.id, i as SlotIndex);
          tempS = shiftMeter(tempS, 1, `Device removed from ${home.name}`);
          removed++;
        }
      }
      s = tempS;
      break;
    }

    case 'remove-device-any':
    case 'remove-devices-any': {
      const targetId = opts.targetNeighborhoodId;
      const targetSlot = opts.targetSlotIndex;
      if (targetId !== undefined && targetSlot !== undefined) {
        const count = card.effectValue ?? 1;
        let removed = 0;
        let tempS = s;
        // Remove from specific slot first, then others
        if (removed < count && tempS.neighborhoods.find((n) => n.id === targetId)!.slots[targetSlot] !== null) {
          tempS = removeDeviceFromSlot(tempS, targetId, targetSlot);
          tempS = shiftMeter(tempS, 1, `Device removed from ${targetId}`);
          removed++;
        }
        // For remove-devices-any with count > 1, remove more from same neighborhood
        if (card.effectType === 'remove-devices-any' && count > 1) {
          const n = tempS.neighborhoods.find((nb) => nb.id === targetId)!;
          for (let i = 0; i < 4 && removed < count; i++) {
            if (n.slots[i] !== null) {
              tempS = removeDeviceFromSlot(tempS, targetId, i as SlotIndex);
              tempS = shiftMeter(tempS, 1, `Device removed from ${targetId}`);
              removed++;
            }
          }
        }
        s = tempS;
      }
      break;
    }

    case 'remove-all-own': {
      const player = s.players.find((p) => p.id === playerId)!;
      const nId = player.role.homeNeighborhood;
      const n = s.neighborhoods.find((nb) => nb.id === nId)!;
      let tempS = s;
      for (let i = 0; i < 4; i++) {
        if (n.slots[i] !== null) {
          tempS = removeDeviceFromSlot(tempS, nId, i as SlotIndex);
          tempS = shiftMeter(tempS, 1, `Device removed from ${n.name}`);
        }
      }
      s = tempS;
      break;
    }

    case 'block-board-phase':
      s = { ...s, blockedBoardPhases: s.blockedBoardPhases + 1 };
      s = log(s, 'Board Phase blocked for 1 round!');
      break;

    case 'cancel-next-surveillance':
      s = { ...s, cancelNextSurveillance: s.cancelNextSurveillance + 1 };
      s = log(s, 'Next Surveillance Card placement cancelled!');
      break;

    case 'cancel-next-2-surveillance':
      s = { ...s, cancelNextSurveillance: s.cancelNextSurveillance + 2 };
      s = log(s, 'Next 2 Surveillance Card placements cancelled!');
      break;

    case 'cancel-next-incident':
      s = { ...s, cancelNextIncident: true };
      s = log(s, 'Next Incident Card will be cancelled!');
      break;

    case 'cancel-footage-request':
      s = shiftMeter(s, card.effectValue ?? 1, card.name);
      s = { ...s, cancelNextIncident: true };
      s = log(s, 'Next Police Footage Request cancelled!');
      break;

    case 'wildcard-deposit':
      s = log(s, `${card.name} counts as wildcard for next deposit.`);
      break;

    case 'actions-all':
      s = { ...s, pendingExtraActions: s.pendingExtraActions + (card.effectValue ?? 1) };
      s = log(s, `All players gain +${card.effectValue ?? 1} action(s) next turn.`);
      break;

    case 'actions-current':
      s = { ...s, actionsRemaining: s.actionsRemaining + (card.effectValue ?? 1) };
      s = log(s, `+${card.effectValue ?? 1} action(s) added.`);
      break;

    case 'move-any':
      if (opts.chosenPosition) {
        const players = s.players.map((p) =>
          p.id === playerId ? { ...p, position: opts.chosenPosition! } : p
        );
        s = { ...s, players };
        s = log(s, `${s.players[playerId].role.name} moved to ${opts.chosenPosition}`);
      }
      break;

    case 'move-player-here': {
      if (opts.targetPlayerId !== undefined) {
        const mover = s.players.find((p) => p.id === playerId)!;
        const players = s.players.map((p) =>
          p.id === opts.targetPlayerId ? { ...p, position: mover.position } : p
        );
        s = { ...s, players };
        s = log(s, `Player moved to ${mover.position}`);
      }
      break;
    }

    case 'reveal-surveillance': {
      const count = card.effectValue ?? 3;
      const revealed = s.surveillanceDeck.slice(0, count);
      s = { ...s, revealedSurveillanceCards: revealed };
      s = log(s, `Revealed top ${revealed.length} Surveillance Cards.`);
      break;
    }

    case 'reveal-top-surveillance': {
      const revealed = s.surveillanceDeck.slice(0, 1);
      s = { ...s, revealedSurveillanceCards: revealed };
      s = log(s, `Revealed top Surveillance Card.`);
      break;
    }

    case 'reduced-deposit':
      s = { ...s, reducedNextDeposit: true };
      s = log(s, 'Next Town Square deposit only needs 4 cards!');
      break;

    case 'board-phase-reduced':
      s = { ...s, reducedBoardPhaseRounds: s.reducedBoardPhaseRounds + (card.effectValue ?? 3) };
      s = log(s, `Board Phase reduced for ${card.effectValue ?? 3} rounds.`);
      break;

    case 'swap-cards':
    case 'none':
      break;
  }

  return s;
}

// ── Win/Loss Check ─────────────────────────────────────────────────────────

function checkWinLoss(state: GameState): GameState {
  if (state.privacyMeter <= 0) {
    return { ...state, phase: 'lost', lossReason: 'Privacy and Community Trust Meter hit 0.' };
  }
  if (state.round > MAX_ROUNDS) {
    return { ...state, phase: 'lost', lossReason: `The city completed its surveillance rollout. You ran out of time after ${MAX_ROUNDS} rounds.` };
  }
  const gameHasProgressed = state.surveillanceDiscard.length > 0;
  const allClear = state.neighborhoods.every((n) => n.densityTrack === 0);
  if (gameHasProgressed && allClear) {
    return { ...state, phase: 'won' };
  }
  return state;
}

function advanceTurnWithIncident(s: GameState, playerRoleId: string): GameState {
  const incidentCard = getIncidentForRound(s.round);
  if (!incidentCard || s.incidentFiredThisRound) return advanceTurn(s);

  // Incidents always land at the end of the last player's turn in the round,
  // right before the Board Phase reveal.
  const isLastPlayer = s.currentPlayerIndex === s.players.length - 1;
  if (!isLastPlayer) return advanceTurn(s);

  s = { ...s, incidentFiredThisRound: true };

  if (s.cancelNextIncident) {
    s = { ...s, cancelNextIncident: false };
    s = log(s, `Incident "${incidentCard.name}" cancelled by Class Action.`);
    return advanceTurn(s);
  }

  s = shiftMeter(s, -1, `Incident: ${incidentCard.name}`);
  s = advanceTurn(s);
  s = { ...s, pendingIncident: { card: incidentCard, triggeredByRoleId: playerRoleId } };
  s = log(s, `⚠️ INCIDENT: ${incidentCard.name}`);
  return s;
}

function advanceTurn(s: GameState): GameState {
  const nextIndex = (s.currentPlayerIndex + 1) % s.players.length;
  const isNewRound = nextIndex === 0;
  if (isNewRound) {
    s = { ...s, phase: 'board-phase', currentPlayerIndex: nextIndex };
    s = log(s, 'All players done — moving to Board Phase.');
  } else {
    const nextPlayer = s.players[nextIndex];
    const players = s.players.map((p) =>
      p.id === nextPlayer.id ? { ...p, hasUsedSpecialAbilityThisTurn: false } : p
    );
    s = {
      ...s,
      currentPlayerIndex: nextIndex,
      actionsRemaining: 0,
      players,
      phase: 'player-turn',
      pendingDiceRoll: true,
    };
    s = log(s, `${nextPlayer.role.name}'s turn — roll the dice!`);
  }
  return checkWinLoss(s);
}

// ── Main Reducer ──────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  switch (action.type) {

    // ── Roll die (start of player turn) ───────────────────────────────
    case 'ROLL_DIE': {
      if (!state.pendingDiceRoll) return state;
      const roll = action.precomputedRoll ?? (Math.floor(Math.random() * 6) + 1);
      let s: GameState = {
        ...state,
        actionsRemaining: roll + state.pendingExtraActions,
        pendingExtraActions: 0,
        pendingDiceRoll: false,
        lastDiceRoll: roll,
      };
      s = log(s, `${s.players[s.currentPlayerIndex].role.name} rolled a ${roll}! (${s.actionsRemaining} actions)`);
      return s;
    }

    // ── Move ──────────────────────────────────────────────────────────
    case 'MOVE': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      if (!getReachablePositions(player.position).includes(action.to)) return state;
      const players = state.players.map((p) =>
        p.id === player.id ? { ...p, position: action.to } : p
      );
      let s = spendActions({ ...state, players }, 1);
      s = log(s, `${s.players[state.currentPlayerIndex].role.name} moved to ${action.to}`);
      return s;
    }

    // ── Remove device (standard: 1 action + 2 cards matching neighborhood color) ──────
    case 'REMOVE_DEVICE': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      const hand = player.hand;
      const cards = action.cardIds.map((id) => hand.find((c) => c.id === id)!).filter(Boolean);
      if (cards.length < 2) return state;
      if (cards[0].category !== cards[1].category) return state;
      const NHCOLOR: Record<string, string> = { suburb: 'yellow', courthouse: 'blue', media: 'green', politics: 'red' };
      if (cards[0].category !== NHCOLOR[action.neighborhoodId]) return state;

      const n = state.neighborhoods.find((nb) => nb.id === action.neighborhoodId);
      if (!n || n.slots[action.slotIndex] === null) return state;

      let s = removeCardFromHand(state, player.id, action.cardIds);
      s = removeDeviceFromSlot(s, action.neighborhoodId, action.slotIndex);
      s = shiftMeter(s, 1, `Device removed from ${n.name}`);
      s = spendActions(s, 1);
      s = log(s, `${player.role.name} removed device from ${n.name} slot ${action.slotIndex + 1}`);
      return checkWinLoss(s);
    }

    // ── Legal Advocate special remove (any 2 cards) ───────────────────
    case 'CAPTAIN_REVERSE_OVERFLOW': {
      const player = state.players[state.currentPlayerIndex];
      if (player.role.id !== 'captain') return state;
      if (state.actionsRemaining < 1) return state;
      if (player.hasUsedSpecialAbilityThisTurn) return state;
      // Need 2 cards in hand and a tracker above its minimum to lower
      const cards = action.cardIds.map((id) => player.hand.find((c) => c.id === id)).filter(Boolean);
      if (cards.length < 2) return state;
      if (state.densityTracker <= 1) return log(state, 'Surveillance Density Tracker is already at its lowest.');

      let s = removeCardFromHand(state, player.id, action.cardIds);
      s = { ...s, densityTracker: Math.max(1, s.densityTracker - 1) };
      s = spendActions(s, 1);
      const players = s.players.map((p) =>
        p.id === player.id ? { ...p, hasUsedSpecialAbilityThisTurn: true } : p
      );
      s = { ...s, players };
      s = log(s, `${player.role.name} reversed overflow — Density Tracker lowered to ${s.densityTracker}`);
      return checkWinLoss(s);
    }

    case 'LEGAL_REMOVE_DEVICE': {
      const player = state.players[state.currentPlayerIndex];
      if (player.role.id !== 'legal') return state;
      if (state.actionsRemaining < 1) return state;
      if (player.hasUsedSpecialAbilityThisTurn) return state;

      // Legal Advocate must spend 2 cards of DIFFERENT colors
      const cards = action.cardIds.map((id) => player.hand.find((c) => c.id === id)).filter(Boolean) as CommunityCard[];
      if (cards.length < 2 || cards[0].category === cards[1].category) return state;

      const n = state.neighborhoods.find((nb) => nb.id === action.neighborhoodId);
      if (!n || n.slots[action.slotIndex] === null) return state;

      let s = removeCardFromHand(state, player.id, action.cardIds);
      s = removeDeviceFromSlot(s, action.neighborhoodId, action.slotIndex);
      s = shiftMeter(s, 1, `Lawyer removed device from ${n.name}`);
      s = spendActions(s, 1);
      const players = s.players.map((p) =>
        p.id === player.id ? { ...p, hasUsedSpecialAbilityThisTurn: true } : p
      );
      s = { ...s, players };
      s = log(s, `${player.role.name} used special ability to remove device from ${n.name}`);
      return checkWinLoss(s);
    }

    // ── Swap cards ────────────────────────────────────────────────────
    case 'SWAP_CARDS': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      const other = state.players.find((p) => p.id === action.withPlayerId);
      if (!other) return state;
      if (player.position !== other.position) return state;

      const giveCards = player.hand.filter((c) => action.giveCardIds.includes(c.id));
      const takeCards = other.hand.filter((c) => action.takeCardIds.includes(c.id));

      const players = state.players.map((p) => {
        if (p.id === player.id) {
          const hand = [
            ...p.hand.filter((c) => !action.giveCardIds.includes(c.id)),
            ...takeCards,
          ];
          return { ...p, hand };
        }
        if (p.id === action.withPlayerId) {
          const hand = [
            ...p.hand.filter((c) => !action.takeCardIds.includes(c.id)),
            ...giveCards,
          ];
          return { ...p, hand };
        }
        return p;
      });

      let s = spendActions({ ...state, players }, 1);
      s = log(s, `${player.role.name} swapped cards with ${other.role.name}`);
      return s;
    }

    // ── Share Knowledge (give 1 card to co-located player, costs 1 action) ──
    case 'SHARE_KNOWLEDGE': {
      if (state.actionsRemaining < 1) return state;
      const from = state.players[state.currentPlayerIndex];
      if (from.id !== action.fromPlayerId) return state;
      const to = state.players.find((p) => p.id === action.toPlayerId);
      if (!to || from.position !== to.position) return state;
      const card = from.hand.find((c) => c.id === action.cardId);
      if (!card) return state;

      const players = state.players.map((p) => {
        if (p.id === action.fromPlayerId) return { ...p, hand: p.hand.filter((c) => c.id !== action.cardId) };
        if (p.id === action.toPlayerId)   return { ...p, hand: [...p.hand, card] };
        return p;
      });
      let s = spendActions({ ...state, players }, 1);
      s = log(s, `${from.role.name} shared "${card.name}" with ${to.role.name}`);
      return s;
    }

    // ── Play power-up card ────────────────────────────────────────────
    case 'PLAY_CARD': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return state;

      let s = removeCardFromHand(state, player.id, [action.cardId]);
      s = spendActions(s, 1);
      s = applyCardEffect(s, card, player.id, {
        targetNeighborhoodId: action.targetNeighborhoodId,
        targetSlotIndex: action.targetSlotIndex,
        targetPlayerId: action.targetPlayerId,
        chosenPosition: action.chosenPosition,
      });
      s = log(s, `${player.role.name} played "${card.name}"`);
      s = checkWinLoss(s);
      if (s.phase === 'player-turn') {
        // A draw effect may have pushed the player over 7 cards → manual discard
        const limited = enforceHandLimit(s, player.id, false);
        if (limited) return limited;
      }
      return s;
    }

    // ── Deposit at City Hall ──────────────────────────────────────────
    case 'DEPOSIT_AT_CITY_HALL': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      if (player.position !== 'city-hall') return state;

      const required = state.reducedNextDeposit ? 2 : player.role.id === 'council' ? 3 : 4;
      const cards = action.cardIds.map((id) => player.hand.find((c) => c.id === id)!).filter(Boolean);

      if (cards.length < required) return state;

      // Validate: one of each color (blue, yellow, green, red — purple removed)
      const colors = new Set(cards.map((c) => c.category));
      const wildcards = cards.filter((c) => c.effectType === 'wildcard-deposit').length;
      if (colors.size + wildcards < required) {
        return log(state, `Deposit failed: need ${required} different colors (have ${colors.size + wildcards}).`);
      }

      // Find which neighborhood to clear (must be decided by UI — for now clear least dense)
      // In practice UI should pass targetNeighborhoodId — we'll clear the most dense
      const target = [...state.neighborhoods].sort((a, b) => b.densityTrack - a.densityTrack)[0];

      let s = removeCardFromHand(state, player.id, action.cardIds);
      if (s.reducedNextDeposit) s = { ...s, reducedNextDeposit: false };
      // Remove all devices
      for (let i = 0; i < 4; i++) {
        if (target.slots[i] !== null) {
          s = removeDeviceFromSlot(s, target.id, i as SlotIndex);
        }
      }
      s = shiftMeter(s, 4, 'Town Square deposit');
      s = { ...s, densityTracker: Math.max(1, s.densityTracker - 1) };
      s = shiftMeter(s, 1, 'Density Tracker decreased');
      s = spendActions(s, 1);
      s = log(s, `${player.role.name} deposited at the Town Square — ${target.name} cleared!`);
      return checkWinLoss(s);
    }

    // ── Use special ability ───────────────────────────────────────────
    case 'USE_SPECIAL_ABILITY': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      if (player.hasUsedSpecialAbilityThisTurn) return state;

      let s = state;

      switch (player.role.id as RoleId) {
        case 'organizer': {
          // Draw 1 extra card if co-located with another player
          const colocated = s.players.some((p) => p.id !== player.id && p.position === player.position);
          if (colocated) {
            s = drawCommunityCards(s, player.id, 1, false, true);
            s = log(s, `${player.role.name} drew 1 extra card (organizer ability)`);
          } else {
            return log(s, 'Organizer ability requires another player on same space.');
          }
          break;
        }
        case 'captain': {
          // Handled via CAPTAIN_REVERSE_OVERFLOW
          s = log(s, 'Use the Activist ability via the Reverse Overflow action.');
          break;
        }
        case 'council': {
          // Auto-applied at deposit — no standalone action needed
          return log(state, 'Council Member discount is applied automatically when depositing at the Town Square.');
        }
        case 'legal': {
          // Handled via LEGAL_REMOVE_DEVICE
          s = log(s, 'Use Lawyer ability via the Remove Device (any 2 cards) action.');
          break;
        }
      }

      const players = s.players.map((p) =>
        p.id === player.id ? { ...p, hasUsedSpecialAbilityThisTurn: true } : p
      );
      s = spendActions({ ...s, players }, 1);
      s = checkWinLoss(s);
      if (s.phase === 'player-turn') {
        // Organizer's draw may have pushed them over 7 cards → manual discard
        const limited = enforceHandLimit(s, player.id, false);
        if (limited) return limited;
      }
      return s;
    }

    // ── End turn ──────────────────────────────────────────────────────
    case 'END_TURN': {
      const player = state.players[state.currentPlayerIndex];
      let s = state;

      // Promote any deferred incident (from card play) to active incident before end-of-turn draw
      if (s.pendingDeferredIncident) {
        s = { ...s, pendingIncident: s.pendingDeferredIncident, pendingDeferredIncident: null };
        return s;
      }

      // Peek 2 community cards — hold them for display before adding to hand
      const { state: s2, drawnCards } = peekDrawCards(s, 2);
      s = s2;

      // Organizer draws an extra card if colocated (same neighborhood counts)
      let extraDrawn: CommunityCard[] = [];
      if (player.role.id === 'organizer') {
        const nids = ['suburb', 'courthouse', 'media', 'politics'] as const;
        const playerNhd = nids.find((id) => player.position === id || player.position.startsWith(id + '-n'));
        const colocated = s.players.some((p) => {
          if (p.id === player.id) return false;
          if (playerNhd && (p.position === playerNhd || p.position.startsWith(playerNhd + '-n'))) return true;
          return p.position === player.position;
        });
        if (colocated) {
          const { state: s3, drawnCards: extra } = peekDrawCards(s, 1);
          s = s3;
          extraDrawn = extra;
        }
      }

      const allDrawn = [...drawnCards, ...extraDrawn];

      if (allDrawn.length > 0) {
        return { ...s, pendingDrawnCards: { playerId: player.id, cards: allDrawn } };
      }

      // No community cards drawn (all were incidents or deck empty) — advance immediately
      return advanceTurn(s);
    }

    // ── Acknowledge drawn cards (add peeked cards to hand) ────────────
    case 'ACKNOWLEDGE_DRAWN_CARDS': {
      if (!state.pendingDrawnCards) return state;
      const { playerId, cards } = state.pendingDrawnCards;
      const player = state.players.find((p) => p.id === playerId)!;
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, hand: [...p.hand, ...cards] } : p
      );
      let s: GameState = { ...state, players, pendingDrawnCards: null };
      s = log(s, `${player.role.name} drew ${cards.length} card${cards.length !== 1 ? 's' : ''}.`);

      // End-of-turn draw may exceed 7 → manual discard, then advance the turn
      const limited = enforceHandLimit(s, playerId, true);
      if (limited) return limited;

      return advanceTurnWithIncident(s, player.role.id);
    }

    case 'DISCARD_TO_HAND_LIMIT': {
      if (!state.pendingDiscard) return state;
      const { playerId, count, advanceAfter } = state.pendingDiscard;
      if (action.cardIds.length !== count) return state;
      const discardPlayer = state.players.find((p) => p.id === playerId)!;
      let s = removeCardFromHand(state, playerId, action.cardIds);
      s = log(s, `${discardPlayer.role.name} discarded ${count} card(s) to meet the hand limit.`);
      s = { ...s, pendingDiscard: null };
      // Only end the turn if the overflow came from the end-of-turn draw
      return advanceAfter ? advanceTurnWithIncident(s, discardPlayer.role.id) : s;
    }

    // ── Board Phase ───────────────────────────────────────────────────
    case 'BOARD_PHASE': {
      let s = state;

      if (s.blockedBoardPhases > 0) {
        s = { ...s, blockedBoardPhases: s.blockedBoardPhases - 1 };
        s = log(s, 'Board Phase blocked by community action!');
      } else if (s.cancelNextSurveillance > 0) {
        s = { ...s, cancelNextSurveillance: s.cancelNextSurveillance - 1 };
        const top = s.surveillanceDeck[0];
        if (top) {
          const deck = s.surveillanceDeck.slice(1);
          s = { ...s, surveillanceDeck: deck, surveillanceDiscard: [...s.surveillanceDiscard, top] };
          s = log(s, `Surveillance Card cancelled: ${top.neighborhood} slot ${top.slot + 1}`);
        }
      } else {
        let deck = [...s.surveillanceDeck];
        if (deck.length === 0) {
          deck = shuffle([...s.surveillanceDiscard]);
          s = { ...s, surveillanceDiscard: [] };
          s = log(s, 'Surveillance deck reshuffled from discard.');
        }

        const card = deck.shift()!;
        s = { ...s, surveillanceDeck: deck, surveillanceDiscard: [...s.surveillanceDiscard, card] };

        const device = deviceForTracker(s.densityTracker);
        s = placeDevice(s, card.neighborhood, card.slot, device);
        s = log(s, `Board Phase: ${deviceEmoji(device)} placed in ${card.neighborhood} slot ${card.slot + 1}`);
      }

      if (s.reducedBoardPhaseRounds > 0) {
        s = { ...s, reducedBoardPhaseRounds: s.reducedBoardPhaseRounds - 1 };
        s = log(s, `Board Phase reduced (${s.reducedBoardPhaseRounds} round(s) remaining).`);
      }

      // Clear revealed surveillance cards after board phase
      s = { ...s, revealedSurveillanceCards: [] };

      // Advance to the next round — straight into player turns (no preview phase)
      const nextPlayers = s.players.map((p) => ({ ...p, hasUsedSpecialAbilityThisTurn: false }));
      s = {
        ...s,
        phase: 'player-turn',
        round: s.round + 1,
        currentPlayerIndex: 0,
        actionsRemaining: 0,
        players: nextPlayers,
        pendingDiceRoll: true,
        densityTracker: Math.min(8, s.densityTracker + 1),
        incidentFiredThisRound: false,
        resolvedIncident: null,
      };
      s = log(s, `--- Round ${s.round} begins — ${s.players[0].role.name}, roll the dice! ---`);

      return checkWinLoss(s);
    }

    // ── Incident vote ─────────────────────────────────────────────────
    case 'INCIDENT_VOTE': {
      if (!state.pendingIncident) return state;
      const incident = state.pendingIncident.card;
      return resolveIncident(state, incident, action.choice);
    }

    // ── Discard card ──────────────────────────────────────────────────
    case 'DISCARD_CARD': {
      const player = state.players[state.currentPlayerIndex];
      return removeCardFromHand(state, player.id, [action.cardId]);
    }

    default:
      return state;
  }
}
