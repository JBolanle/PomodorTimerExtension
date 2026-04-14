export interface BlocklistCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  domains: string[];
  enabled: boolean;
}

// FocusModeSettings now lives in `src/shared/types`; re-exported for
// legacy import compatibility.
export type { FocusModeSettings } from '@/shared/types';

export const PREDEFINED_BLOCKLISTS: BlocklistCategory[] = [
  {
    id: 'social',
    name: 'Social Media',
    emoji: '📱',
    description: 'Facebook, Twitter, Instagram, TikTok, etc.',
    domains: [
      'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
      'tiktok.com', 'snapchat.com', 'linkedin.com', 'reddit.com',
      'threads.net', 'mastodon.social', 'bsky.app',
    ],
    enabled: true,
  },
  {
    id: 'video',
    name: 'Video & Streaming',
    emoji: '📺',
    description: 'YouTube, Netflix, Twitch, etc.',
    domains: [
      'youtube.com', 'netflix.com', 'twitch.tv', 'hulu.com',
      'disneyplus.com', 'primevideo.com', 'max.com',
    ],
    enabled: true,
  },
  {
    id: 'news',
    name: 'News & Media',
    emoji: '📰',
    description: 'News sites and aggregators',
    domains: [
      'news.ycombinator.com', 'cnn.com', 'bbc.com',
      'nytimes.com', 'theguardian.com',
    ],
    enabled: false,
  },
  {
    id: 'shopping',
    name: 'Shopping',
    emoji: '🛒',
    description: 'Amazon, eBay, etc.',
    domains: [
      'amazon.com', 'ebay.com', 'etsy.com', 'aliexpress.com',
    ],
    enabled: false,
  },
  {
    id: 'gaming',
    name: 'Gaming',
    emoji: '🎮',
    description: 'Gaming platforms and communities',
    domains: [
      'store.steampowered.com', 'steamcommunity.com',
      'discord.com', 'epicgames.com', 'itch.io',
    ],
    enabled: false,
  },
];

export { DEFAULT_FOCUS_MODE_SETTINGS } from '@/shared/constants';
