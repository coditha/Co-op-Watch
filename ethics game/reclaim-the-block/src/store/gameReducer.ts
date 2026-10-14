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
    clearBanner: null,
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
  | { type: 'SWAP_CARDS'; withPlayerId: number; giveCardIds: string[]; takeCardIds: string[] }
  | { type: 'TRANSFER_CARD'; fromPlayerId: number; toPlayerId: number; cardId: string }
  | { type: 'DEPOSIT_AT_CITY_HALL'; cardIds: string[] }
  | { type: 'END_TURN' }
  | { type: 'ACKNOWLEDGE_DRAWN_CARDS' }
  | { type: 'DISCARD_TO_HAND_LIMIT'; cardIds: string[] }
  | { type: 'BOARD_PHASE' }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'INCIDENT_VOTE'; choice: 'support' | 'pushback'; discardCardId?: string }
  | { type: 'DISCARD_CARD'; cardId: string };

// ── Helpers ───────────────────────────────────────────────────────────────

// Draws community cards and returns them separately instead of adding to hand.
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
  device: DeviceType,
  options: { skipMeterPenalty?: boolean } = {}
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
  if (!options.skipMeterPenalty) {
    const deviceShift = meterShiftForDevice(device);
    s = shiftMeter(s, deviceShift, `${deviceEmoji(device)} placed in ${n.name}`);
  }

  if (densityTrack === 4) {
    s = { ...s, densityTracker: Math.min(8, s.densityTracker + 1) };
    s = log(s, `Density Tracker increased to ${s.densityTracker}`);
  }

  // Flock reader bleed (also a trust penalty, so incident outcomes that set
  // their own exact trust change skip it too)
  if (device === 'flock-reader' && !options.skipMeterPenalty) {
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

// Records the community's choice only — the actual device/meter consequence
// isn't applied until the player clicks the Board Phase button (see
// applyResolvedIncidentEffect), so nothing changes on the board from a
// mere Support/Push Back click.
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
      deviceTarget: outcome.deviceTarget,
      deviceCount: outcome.deviceCount,
      meterDelta: outcome.meterDelta,
      skipDeviceMeterPenalty: outcome.skipDeviceMeterPenalty,
    },
  };
  s = log(s, `${incident.name} — ${choice === 'support' ? 'Support' : 'Push Back'}: ${outcome.text}`);
  return s;
}

// Applies the effect of a resolved incident choice — called from BOARD_PHASE
// so the consequence lands exactly when the player clicks the board button.
function applyResolvedIncidentEffect(state: GameState): GameState {
  const r = state.resolvedIncident;
  if (!r) return state;
  let s = state;

  if (r.deviceTarget) {
    const targetIds: NeighborhoodId[] =
      r.deviceTarget === 'all' ? s.neighborhoods.map((n) => n.id) : [r.deviceTarget];
    const count = r.deviceCount ?? 1;
    for (const nId of targetIds) {
      for (let i = 0; i < count; i++) {
        const emptySlot = s.neighborhoods
          .find((n) => n.id === nId)!
          .slots.findIndex((sl) => sl === null);
        if (emptySlot === -1) break;
        s = placeDevice(s, nId, emptySlot as SlotIndex, deviceForTracker(s.densityTracker), {
          skipMeterPenalty: r.skipDeviceMeterPenalty,
        });
      }
    }
  }

  if (r.meterDelta) {
    s = shiftMeter(s, r.meterDelta, r.name);
  }

  return s;
}

// True combined effect of the resolved incident choice — the chosen device
// count, plus the trust cost each of those devices carries on its own (via
// placeDevice's built-in per-device penalty, unless the outcome opts out via
// skipDeviceMeterPenalty), so the Board Phase button can state the real
// total instead of just the device count.
export function previewResolvedIncidentEffect(
  state: GameState
): { deviceCount: number; meterDelta: number } | null {
  const r = state.resolvedIncident;
  if (!r) return null;
  let deviceCount = 0;
  let meterDelta = r.meterDelta ?? 0;
  if (r.deviceTarget) {
    deviceCount = r.deviceCount ?? 1;
    if (!r.skipDeviceMeterPenalty) {
      meterDelta += meterShiftForDevice(deviceForTracker(state.densityTracker)) * deviceCount;
    }
  }
  return { deviceCount, meterDelta };
}

// Where a regular (non-incident) Board Phase device lands. The drawn card names
// a slot; if that slot is already taken, use the next open slot in the same
// neighborhood, then any open slot, so a drawn device never silently vanishes.
function pickRegularSlot(
  state: GameState,
  card: { neighborhood: NeighborhoodId; slot: SlotIndex }
): { neighborhood: NeighborhoodId; slot: SlotIndex } | null {
  const own = state.neighborhoods.find((n) => n.id === card.neighborhood)!;
  if (own.slots[card.slot] === null) return { neighborhood: card.neighborhood, slot: card.slot };
  const ownOpen = own.slots.findIndex((sl) => sl === null);
  if (ownOpen !== -1) return { neighborhood: card.neighborhood, slot: ownOpen as SlotIndex };
  for (const n of state.neighborhoods) {
    const open = n.slots.findIndex((sl) => sl === null);
    if (open !== -1) return { neighborhood: n.id, slot: open as SlotIndex };
  }
  return null;
}

// What the regular Board Phase will do right now (device placed + total trust
// change, including the device's own penalty), so the button can state it.
export function previewRegularBoardPhase(
  state: GameState
): { deviceCount: number; meterDelta: number; target: { neighborhood: NeighborhoodId; slot: SlotIndex } | null } | null {
  if (state.blockedBoardPhases > 0 || state.cancelNextSurveillance > 0) {
    return { deviceCount: 0, meterDelta: 0, target: null };
  }
  const card = state.surveillanceDeck[0];
  if (!card) return null;
  const target = pickRegularSlot(state, card);
  if (!target) return { deviceCount: 0, meterDelta: 0, target: null };
  const after = placeDevice(state, target.neighborhood, target.slot, deviceForTracker(state.densityTracker));
  return { deviceCount: 1, meterDelta: after.privacyMeter - state.privacyMeter, target };
}

// ── Win/Loss Check ─────────────────────────────────────────────────────────

function checkWinLoss(state: GameState): GameState {
  if (state.privacyMeter <= 0) {
    return { ...state, phase: 'lost', lossReason: 'Privacy and Community Trust Meter hit 0.' };
  }
  if (state.round > MAX_ROUNDS) {
    return { ...state, phase: 'lost', lossReason: `The city completed its surveillance rollout. You ran out of time after ${MAX_ROUNDS} rounds.` };
  }
  // The game always starts with devices on the board, so an empty board is a
  // genuine win. (Don't gate on the surveillance deck having been drawn from:
  // incident rounds skip that draw, which made the game unwinnable.)
  const allClear = state.neighborhoods.every((n) => n.densityTrack === 0);
  if (allClear) {
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
    s = {
      ...s,
      currentPlayerIndex: nextIndex,
      actionsRemaining: 0,
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
      s = { ...s, clearBanner: { id: (state.clearBanner?.id ?? 0) + 1, kind: 'removed', neighborhood: n.name, removed: 1, byRoleId: player.role.id } };
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

    // ── Transfer Card (give 1 card to co-located player, costs 1 action) ──
    case 'TRANSFER_CARD': {
      if (state.actionsRemaining < 1) return state;
      const from = state.players[state.currentPlayerIndex];
      if (from.id !== action.fromPlayerId) return state;
      const to = state.players.find((p) => p.id === action.toPlayerId);
      if (!to || from.position !== to.position) return state;
      if (to.hand.length >= 7) return state; // receiver is at the hand limit
      const card = from.hand.find((c) => c.id === action.cardId);
      if (!card) return state;

      const players = state.players.map((p) => {
        if (p.id === action.fromPlayerId) return { ...p, hand: p.hand.filter((c) => c.id !== action.cardId) };
        if (p.id === action.toPlayerId)   return { ...p, hand: [...p.hand, card] };
        return p;
      });
      let s = spendActions({ ...state, players }, 1);
      s = log(s, `${from.role.name} transferred "${card.name}" to ${to.role.name}`);
      return s;
    }

    // ── Deposit at City Hall ──────────────────────────────────────────
    case 'DEPOSIT_AT_CITY_HALL': {
      if (state.actionsRemaining < 1) return state;
      const player = state.players[state.currentPlayerIndex];
      if (player.position !== 'city-hall') return state;

      const required = state.reducedNextDeposit ? 2 : 4;
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

      const removedCount = target.densityTrack;
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
      s = { ...s, clearBanner: { id: (state.clearBanner?.id ?? 0) + 1, kind: 'cleared', neighborhood: target.name, removed: removedCount, byRoleId: player.role.id } };
      return checkWinLoss(s);
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

      const allDrawn = drawnCards;

      if (allDrawn.length > 0) {
        return { ...s, pendingDrawnCards: { playerId: player.id, cards: allDrawn } };
      }

      // No community cards drawn (deck empty) — advance immediately, still firing
      // this round's incident if this was the last player's turn
      return advanceTurnWithIncident(s, player.role.id);
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
      let s = applyResolvedIncidentEffect(state);

      if (s.resolvedIncident) {
        // The incident's chosen outcome already fully describes this round's
        // board effect (that's what the button label states) — skip the
        // separate regular per-round device draw so nothing extra happens.
      } else if (s.blockedBoardPhases > 0) {
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
        const target = pickRegularSlot(s, card);
        if (target) {
          s = placeDevice(s, target.neighborhood, target.slot, device);
          s = log(s, `Board Phase: ${deviceEmoji(device)} placed in ${target.neighborhood} slot ${target.slot + 1}`);
        } else {
          s = log(s, 'Board Phase: every slot is already full, no device placed.');
        }
      }

      if (s.reducedBoardPhaseRounds > 0) {
        s = { ...s, reducedBoardPhaseRounds: s.reducedBoardPhaseRounds - 1 };
        s = log(s, `Board Phase reduced (${s.reducedBoardPhaseRounds} round(s) remaining).`);
      }

      // Clear revealed surveillance cards after board phase
      s = { ...s, revealedSurveillanceCards: [] };

      // Stay in 'board-phase' here — the device placement / meter shift above
      // needs to be visible on the board before the round actually advances.
      // The UI dispatches ADVANCE_ROUND separately once that's had time to show.
      return checkWinLoss(s);
    }

    // ── Advance to the next round (dispatched after the Board Phase effect
    // above has had a moment to visibly land) ─────────────────────────────
    case 'ADVANCE_ROUND': {
      let s: GameState = {
        ...state,
        phase: 'player-turn',
        round: state.round + 1,
        currentPlayerIndex: 0,
        actionsRemaining: 0,
        pendingDiceRoll: true,
        densityTracker: Math.min(8, state.densityTracker + 1),
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
