import { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportToJSON, exportToCSV } from '@/lib/export';
import type { SessionRecord, Preset } from '@/types';

interface ExportDropdownProps {
  sessions: SessionRecord[];
  presets: Preset[];
  disabled?: boolean;
}

export function ExportDropdown({ sessions, presets, disabled }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(!open)}>
        <Download className="mr-1 h-4 w-4" />
        Export
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-md">
          <button
            type="button"
            className="flex w-full items-center rounded px-3 py-2 text-sm text-foreground hover:bg-accent"
            onClick={() => { exportToJSON(sessions, presets); setOpen(false); }}
          >
            JSON (full backup)
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded px-3 py-2 text-sm text-foreground hover:bg-accent"
            onClick={() => { exportToCSV(sessions); setOpen(false); }}
          >
            CSV (spreadsheet)
          </button>
        </div>
      )}
    </div>
  );
}
