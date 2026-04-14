import { useState, useEffect, useRef } from 'react';
import { Tag, FileText, X } from 'lucide-react';
import { sendMessage } from '@/lib/messaging';

interface SessionMetaInputProps {
  note: string;
  tags: string[];
  onUpdate: (note: string, tags: string[]) => void;
}

export function SessionMetaInput({ note, tags, onUpdate }: SessionMetaInputProps) {
  const [localNote, setLocalNote] = useState(note);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sendMessage('getTagHistory').then((res) => {
      if (Array.isArray(res)) setSuggestions(res);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLocalNote(note);
    setLocalTags(tags);
  }, [note, tags]);

  function handleNoteChange(value: string) {
    setLocalNote(value);
    onUpdate(value, localTags);
  }

  function handleAddTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || localTags.includes(normalized) || normalized.length > 30) return;
    const newTags = [...localTags, normalized].slice(0, 10);
    setLocalTags(newTags);
    setTagInput('');
    setShowSuggestions(false);
    onUpdate(localNote, newTags);
  }

  function handleRemoveTag(tag: string) {
    const newTags = localTags.filter((t) => t !== tag);
    setLocalTags(newTags);
    onUpdate(localNote, newTags);
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && localTags.length > 0) {
      handleRemoveTag(localTags[localTags.length - 1]);
    }
  }

  const filteredSuggestions = suggestions
    .filter((s) => s.includes(tagInput.toLowerCase()) && !localTags.includes(s))
    .slice(0, 5);

  return (
    <div className="w-full space-y-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" aria-hidden="true" />
          What are you working on?
        </label>
        <input
          type="text"
          value={localNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="e.g., Quarterly report draft"
          maxLength={200}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" aria-hidden="true" />
          Tags (optional)
        </label>
        <div className="relative">
          <div className="flex flex-wrap gap-1 p-2 border border-border rounded-lg bg-background min-h-[42px]">
            {localTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full"
              >
                {tag}
                <button onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`} className="hover:text-primary/70">
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={handleTagInputKeyDown}
              placeholder={localTags.length === 0 ? 'Add tags...' : ''}
              className="flex-1 min-w-[80px] text-sm bg-transparent outline-none"
            />
          </div>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-10">
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); handleAddTag(s); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
      </div>
    </div>
  );
}
