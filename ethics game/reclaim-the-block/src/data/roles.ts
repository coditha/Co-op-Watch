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
    description: 'A parent deeply embedded in the community who knows their neighbors and builds trust through everyday connections.',
  },
  {
    id: 'legal',
    name: 'Lawyer',
    homeNeighborhood: 'courthouse',
    color: 'blue',
    colorHex: '#3b82f6',
    emoji: '🔵',
    characterImage: asset('/characters/briefcase.png'),
    description: 'A lawyer who understands the system from the inside and knows how to use the law to protect residents from surveillance.',
  },
  {
    id: 'captain',
    name: 'Activist',
    homeNeighborhood: 'media',
    color: 'green',
    colorHex: '#22c55e',
    emoji: '🟢',
    characterImage: asset('/characters/megaphone.png'),
    description: 'A seasoned activist who knows how to shift the narrative and organize neighbors to push back on the rollout.',
  },
  {
    id: 'council',
    name: 'City Council Member',
    homeNeighborhood: 'politics',
    color: 'red',
    colorHex: '#ef4444',
    emoji: '🔴',
    characterImage: asset('/characters/gavel.png'),
    description: 'An insider with political leverage who understands how decisions get made at City Hall.',
  },
];
