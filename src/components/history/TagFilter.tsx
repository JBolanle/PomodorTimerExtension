import { useMemo } from 'react';
import { Tag, X } from 'lucide-react';
import type { Session } from '@/shared/types';

interface TagFilterProps {
  sessions: Session[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ sessions, selectedTags, onChange }: TagFilterProps) {
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    sessions.forEach((s) => s.tags?.forEach((t: string) => tags.add(t)));
    return Array.from(tags).sort();
  }, [sessions]);

  if (allTags.length === 0) return null;

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Tag className="w-3 h-3" aria-hidden="true" />
        Filter by tag:
      </div>
      <div className="flex flex-wrap gap-1">
        {allTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {tag}
              {isSelected && <X className="w-3 h-3" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
