import type { IncidentCard } from '../types/game';
import { INCIDENT_CARDS } from './cards';

interface RoundConfig {
  incidentId?: string;
  boardPhaseEvent: string;
}

export const ROUND_CONFIG: Record<number, RoundConfig> = {
  1: {
    incidentId: 'incident-01',
    boardPhaseEvent: 'Package thefts lead more residents to install home cameras.',
  },
  2: {
    incidentId: 'incident-04',
    boardPhaseEvent: 'The city looks to expand cameras into parks, transit stops, and public plazas.',
  },
  3: {
    incidentId: 'incident-02',
    boardPhaseEvent: 'Police request access to upgrade public cameras with facial recognition.',
  },
  4: {
    incidentId: 'incident-07',
    boardPhaseEvent: 'Automated license plate readers begin logging vehicles at major intersections.',
  },
  5: {
    incidentId: 'incident-03',
    boardPhaseEvent: 'A city report reveals residents’ movements have been logged without their knowledge.',
  },
  6: {
    incidentId: 'incident-06',
    boardPhaseEvent: 'Residents organize a march against the growing surveillance network.',
  },
  7: {
    incidentId: 'incident-09',
    boardPhaseEvent: 'The city proposes predicting where incidents are likely to occur.',
  },
  8: {
    boardPhaseEvent: 'No theft. No accident. No proposal. Maplewood is safe now. At least, that is what the cameras say. No decision. No vote. The end.',
  },
};

export function getIncidentForRound(round: number): IncidentCard | undefined {
  const config = ROUND_CONFIG[round];
  if (!config) return undefined;
  return INCIDENT_CARDS.find((c) => c.id === config.incidentId) as IncidentCard | undefined;
}

export function getBoardPhaseEvent(round: number): string {
  return ROUND_CONFIG[round]?.boardPhaseEvent ?? 'The city is placing the next surveillance device.';
}
