import { useTheme } from '@/hooks/useTheme';
import { THEMES, THEME_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Theme } from '@/types';

const THEME_SWATCHES: Record<Theme, string> = {
  arctic: 'bg-[hsl(213,100%,65%)]',
  obsidian: 'bg-[hsl(350,80%,58%)]',
  ember: 'bg-[hsl(43,75%,46%)]',
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-3">
      {THEMES.map((t) => {
        const meta = THEME_META[t];
        const isActive = theme === t;

        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer',
              isActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/40'
            )}
          >
            <div className={cn('h-8 w-8 rounded-full', THEME_SWATCHES[t])} />
            <span className="text-sm font-medium text-foreground">{meta.label}</span>
            <span className="text-xs text-muted-foreground">{meta.description}</span>
          </button>
        );
      })}
    </div>
  );
}
