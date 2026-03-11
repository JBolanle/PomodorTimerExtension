import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TimerMode } from '@/types';

interface ModeSelectorProps {
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  disabled: boolean;
}

const modes: { value: TimerMode; label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'shortBreak', label: 'Short Break' },
  { value: 'longBreak', label: 'Long Break' },
];

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <Tabs
      value={mode}
      onValueChange={(v) => onModeChange(v as TimerMode)}
    >
      <TabsList className="w-full">
        {modes.map((m) => (
          <TabsTrigger
            key={m.value}
            value={m.value}
            disabled={disabled}
            className="flex-1 text-xs"
          >
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
