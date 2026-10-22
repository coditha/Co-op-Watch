export type NeighborhoodId = 'suburb' | 'courthouse' | 'media' | 'politics';
export type RoleId = 'organizer' | 'legal' | 'captain' | 'council';
export type DeviceType = 'ring' | 'smart-speaker' | 'traffic-camera' | 'flock-reader';
export type CardCategory = 'blue' | 'yellow' | 'green' | 'red';
export type SlotIndex = 0 | 1 | 2 | 3;

export type Position =
  | NeighborhoodId
  | 'city-hall'
  | 'suburb-road-1'
  | 'courthouse-road-1'
  | 'media-road-1'
  | 'politics-road-1'
  | 'suburb-n1' | 'suburb-n2' | 'suburb-n3' | 'suburb-n4'
  | 'courthouse-n1' | 'courthouse-n2' | 'courthouse-n3' | 'courthouse-n4'
  | 'media-n1' | 'media-n2' | 'media-n3' | 'media-n4'
  | 'politics-n1' | 'politics-n2' | 'politics-n3' | 'politics-n4'
  | 'suburb-nr1' | 'suburb-nr2' | 'suburb-nr3' | 'suburb-nr4'
  | 'courthouse-nr1' | 'courthouse-nr2' | 'courthouse-nr3' | 'courthouse-nr4'
  | 'media-nr1' | 'media-nr2' | 'media-nr3' | 'media-nr4'
  | 'politics-nr1' | 'politics-nr2' | 'politics-nr3' | 'politics-nr4';

export interface CommunityCard {
  id: string;
  type: 'community';
  category: CardCategory;
  name: string;
  educationalContent: string;
  effect: string;
}


// What one Incident choice does when the Board Phase plays it out. Meter values
// are the full intended change: devices placed here skip their usual penalty.
export interface IncidentOutcome {
  text: string;                                   // what happened, shown in the Board Phase
  addTo?: (NeighborhoodId | 'any')[];             // one device per entry; 'any' lands like a regular Board Phase device
  removeFrom?: (NeighborhoodId | 'most-crowded')[]; // one device per entry
  meterDelta?: number;                            // negative moves the meter toward zero
}

// One option the community can pick on an Incident card.
export interface IncidentChoice extends IncidentOutcome {
  label: string;    // the option itself, e.g. "Support it fully"
  reason?: string;  // the argument for it, shown under the label
}

export interface IncidentCard {
  id: string;
  type: 'incident';
  name: string;
  effect: string;          // prompt shown on the card, e.g. "Does your community:"
  educationalNote: string; // the situation
  choices: IncidentChoice[];
}

export type Card = CommunityCard | IncidentCard;

export interface SurveillanceCard {
  id: string;
  neighborhood: NeighborhoodId;
  slot: SlotIndex;
}

export interface Role {
  id: RoleId;
  name: string;
  homeNeighborhood: NeighborhoodId;
  color: string;
  emoji: string;
  colorHex: string;
  characterImage?: string;
  description: string;
}

export interface Neighborhood {
  id: NeighborhoodId;
  name: string;
  slots: (DeviceType | null)[];
  densityTrack: number;
}

export interface Player {
  id: number;
  role: Role;
  position: Position;
  hand: CommunityCard[];
}

export type GamePhase =
  | 'setup'
  | 'player-turn'
  | 'board-phase'
  | 'check-phase'
  | 'won'
  | 'lost';

export interface PendingIncident {
  card: IncidentCard;
  triggeredByRoleId?: string;
  voteTally?: { comply: number; refuse: number };
}

// The community's choice on the last incident, revealed during the following Board Phase.
// Holds the chosen outcome's effect until the following Board Phase button
// click actually applies it — the choice and the consequence are separate.
export interface ResolvedIncident {
  name: string;
  choiceLabel: string;
  text: string;
  addTo?: (NeighborhoodId | 'any')[];
  removeFrom?: (NeighborhoodId | 'most-crowded')[];
  meterDelta?: number;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  actionsRemaining: number;

  privacyMeter: number;
  densityTracker: number;

  neighborhoods: Neighborhood[];
  players: Player[];

  communityDeck: CommunityCard[];
  communityDiscard: CommunityCard[];
  surveillanceDeck: SurveillanceCard[];
  surveillanceDiscard: SurveillanceCard[];

  pendingIncident: PendingIncident | null;
  resolvedIncident: ResolvedIncident | null;
  pendingDrawnCards: { playerId: number; cards: CommunityCard[] } | null;
  pendingDiscard: { playerId: number; count: number; advanceAfter: boolean } | null;

  pendingDiceRoll: boolean;
  lastDiceRoll: number | null;

  incidentFiredThisRound: boolean;

  // Set when a device is removed or a Town Square deposit clears a neighborhood, so the UI can show a banner.
  // `id` increments each time so the same neighborhood clearing twice re-triggers it.
  clearBanner: { id: number; kind: 'removed' | 'cleared'; neighborhoodId: NeighborhoodId; neighborhood: string; removed: number; byRoleId: string } | null;

  gameLog: string[];
  lossReason?: string;
}
