import { Button } from '@/components/ui/button';

interface TimerControlsProps {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function TimerControls({ running, onStart, onStop }: TimerControlsProps) {
  return (
    <div className="flex gap-3">
      {running ? (
        <Button
          variant="destructive"
          size="lg"
          className="min-w-[120px]"
          onClick={onStop}
        >
          Stop
        </Button>
      ) : (
        <Button
          size="lg"
          className="min-w-[120px]"
          onClick={onStart}
        >
          Start
        </Button>
      )}
    </div>
  );
}
