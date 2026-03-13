import { useState, useCallback } from 'react';
import { getRandomBreakTip } from '@/data/breakTips';

export function BreakTipDisplay({ visible }: { visible: boolean }) {
  const [tip, setTip] = useState(() => getRandomBreakTip());

  const refresh = useCallback(() => {
    setTip(getRandomBreakTip());
  }, []);

  if (!visible) return null;

  return (
    <div className="w-full px-3 py-2 rounded-md bg-muted/50 text-center space-y-1">
      <p className="text-sm" aria-live="polite">
        <span className="mr-1" aria-hidden="true">{tip.emoji}</span>
        {tip.text}
      </p>
      <button
        onClick={refresh}
        aria-label="Show another break tip"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Another tip
      </button>
    </div>
  );
}
