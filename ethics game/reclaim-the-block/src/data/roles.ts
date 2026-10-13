import type { Role } from '../types/game';
import { asset } from '../utils/asset';

export const ROLES: Role[] = [
  {
    id: 'organizer',
    name: 'Parent',
    homeNeighborhood: 'suburb',
    color: 'yellow',
    colorHex: '#f59e0b',
    emoji: '🟡',
    characterImage: asset('/characters/bear.png'),
  },
  {
    id: 'legal',
    name: 'Lawyer',
    homeNeighborhood: 'courthouse',
    color: 'blue',
    colorHex: '#3b82f6',
    emoji: '🔵',
    characterImage: asset('/characters/briefcase.png'),
  },
  {
    id: 'captain',
    name: 'Activist',
    homeNeighborhood: 'media',
    color: 'green',
    colorHex: '#22c55e',
    emoji: '🟢',
    characterImage: asset('/characters/megaphone.png'),
  },
  {
    id: 'council',
    name: 'City Council Member',
    homeNeighborhood: 'politics',
    color: 'red',
    colorHex: '#ef4444',
    emoji: '🔴',
    characterImage: asset('/characters/gavel.png'),
  },
];
