import { useState, useEffect } from 'react';
import { Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionMetaInput } from './SessionMetaInput';

export function CurrentSessionMeta({ visible }: { visible: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      chrome.runtime.sendMessage({ action: 'getSessionMeta' }).then((res) => {
        if (res) {
          setNote(res.note || '');
          setTags(res.tags || []);
        }
      }).catch(() => {});
    }
  }, [visible]);

  async function saveMeta(newNote: string, newTags: string[]) {
    setNote(newNote);
    setTags(newTags);
    await chrome.runtime.sendMessage({ action: 'setSessionMeta', note: newNote, tags: newTags }).catch(() => {});
  }

  if (!visible) return null;

  if (isEditing) {
    return (
      <div className="w-full p-3 bg-muted/30 rounded-lg space-y-3">
        <SessionMetaInput note={note} tags={tags} onUpdate={saveMeta} />
        <Button size="sm" onClick={() => setIsEditing(false)} className="w-full gap-2">
          <Check className="w-4 h-4" />
          Done
        </Button>
      </div>
    );
  }

  const hasMeta = note || tags.length > 0;

  if (hasMeta) {
    return (
      <div className="flex items-start justify-between gap-2 p-3 bg-muted/30 rounded-lg w-full">
        <div className="flex-1 min-w-0">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {note && <p className="text-sm text-muted-foreground truncate">{note}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="shrink-0 h-8 w-8">
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="w-full text-muted-foreground">
      <Edit2 className="w-4 h-4 mr-2" />
      Add note or tags
    </Button>
  );
}
