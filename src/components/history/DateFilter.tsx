import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { DateFilterOption } from '@/types';

const FILTER_LABELS: Record<DateFilterOption, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
  custom: 'Custom Range',
};

interface DateFilterProps {
  value: DateFilterOption;
  onChange: (filter: DateFilterOption, range?: { start: Date; end: Date }) => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  function handleChange(val: string) {
    const filter = val as DateFilterOption;
    if (filter === 'custom') {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(filter);
    }
  }

  function handleApplyCustom() {
    if (startDate && endDate) {
      onChange('custom', {
        start: new Date(startDate),
        end: new Date(endDate + 'T23:59:59.999'),
      });
      setShowCustom(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue>{FILTER_LABELS[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCustom(false)} />
          <div className="relative z-50 w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Custom Date Range</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowCustom(false)}>Cancel</Button>
              <Button size="sm" onClick={handleApplyCustom} disabled={!startDate || !endDate}>Apply</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
