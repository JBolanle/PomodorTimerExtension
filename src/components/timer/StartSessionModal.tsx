import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionMetaInput } from './SessionMetaInput';

interface StartSessionModalProps {
  presetName: string;
  duration: number;
  onStart: (note: string, tags: string[]) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function StartSessionModal({ presetName, duration, onStart, onSkip, onCancel }: StartSessionModalProps) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-5 w-[340px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Start Work Session</h3>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {presetName} · {duration} minutes
        </p>
        <SessionMetaInput
          note={note}
          tags={tags}
          onUpdate={(n, t) => { setNote(n); setTags(t); }}
        />
        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onSkip} className="flex-1">
            Skip
          </Button>
          <Button onClick={() => onStart(note, tags)} className="flex-1 gap-2">
            <Play className="w-4 h-4" />
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}
