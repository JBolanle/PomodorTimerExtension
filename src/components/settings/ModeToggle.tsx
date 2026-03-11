import { Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppMode } from '@/types';

const modes = [
  {
    value: 'simple' as const,
    label: 'Simple',
    description: 'Clean, minimal interface',
    icon: Zap,
  },
  {
    value: 'advanced' as const,
    label: 'Advanced',
    description: 'Full controls & stats',
    icon: BarChart3,
  },
];

export function ModeToggle({ mode, onChange }: { mode: AppMode; onChange: (mode: AppMode) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {modes.map((m) => {
          const isActive = mode === m.value;
          return (
            <button
              key={m.value}
              onClick={() => onChange(m.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer',
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
              )}
            >
              <m.icon className="h-6 w-6" />
              <span className="text-sm font-medium text-foreground">{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.description}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === 'simple'
          ? 'Showing essential settings only. Switch to Advanced for full control.'
          : 'All settings and stats are visible.'}
      </p>
    </div>
  );
}
