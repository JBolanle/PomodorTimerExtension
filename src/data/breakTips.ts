interface BreakTip {
  emoji: string;
  text: string;
  category: string;
}

export const BREAK_TIPS: BreakTip[] = [
  { emoji: '🙆', text: 'Roll your shoulders slowly 5 times forward, then 5 times back.', category: 'stretch' },
  { emoji: '🧘', text: 'Stand up and touch your toes — hold for 10 seconds.', category: 'stretch' },
  { emoji: '💪', text: 'Do a quick desk stretch: interlace fingers, push palms out, hold 15 sec.', category: 'stretch' },

  { emoji: '💧', text: 'Drink a full glass of water.', category: 'hydrate' },
  { emoji: '🍵', text: 'Make yourself a cup of tea or grab a healthy snack.', category: 'hydrate' },

  { emoji: '🚶', text: 'Take a short walk — even 2 minutes helps reset your focus.', category: 'move' },
  { emoji: '🏃', text: 'Do 10 jumping jacks to get your blood flowing.', category: 'move' },
  { emoji: '🪜', text: 'Walk up and down a flight of stairs.', category: 'move' },

  { emoji: '👀', text: 'Look at something 20 feet away for 20 seconds (20-20-20 rule).', category: 'eyes' },
  { emoji: '😌', text: 'Close your eyes and let them rest for 30 seconds.', category: 'eyes' },

  { emoji: '🌬️', text: 'Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat 3x.', category: 'breathe' },
  { emoji: '😮‍💨', text: 'Take 5 deep belly breaths — in through nose, out through mouth.', category: 'breathe' },

  { emoji: '🧠', text: 'Think of 3 things you\'re grateful for right now.', category: 'mindful' },
  { emoji: '🪟', text: 'Look out a window and let your mind wander for a minute.', category: 'mindful' },
  { emoji: '✍️', text: 'Jot down one thing you accomplished this session.', category: 'mindful' },
];

let lastIndex = -1;

export function getRandomBreakTip(): BreakTip {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * BREAK_TIPS.length);
  } while (idx === lastIndex && BREAK_TIPS.length > 1);
  lastIndex = idx;
  return BREAK_TIPS[idx];
}
