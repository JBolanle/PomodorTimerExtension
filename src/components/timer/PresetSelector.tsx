import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Preset } from '@/types';

interface PresetSelectorProps {
  presets: Preset[];
  activePresetId: string;
  onSelect: (presetId: string) => void;
  disabled: boolean;
}

export function PresetSelector({ presets, activePresetId, onSelect, disabled }: PresetSelectorProps) {
  if (presets.length <= 1) return null;

  return (
    <Select value={activePresetId} onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select preset" />
      </SelectTrigger>
      <SelectContent>
        {presets.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
