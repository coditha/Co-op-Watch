import type { RoleId } from '../types/game';

// One objective per role. Only roles in play get one. The group wins when the
// board is clear AND every objective in play is done.
export const OBJECTIVES: Record<RoleId, { short: string; text: string }> = {
  organizer: { short: 'Remove a device in your own community', text: 'Remove a device from your home district.' },
  legal: { short: 'Remove a device in another community', text: 'Remove a device from a district that is not your home.' },
  captain: { short: 'Transfer a card to a teammate', text: 'Give a card to another player.' },
  council: { short: 'Deposit at the Town Square', text: 'Make a Deposit at the Town Square.' },
};
