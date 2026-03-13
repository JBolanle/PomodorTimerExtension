import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { usePresets } from '@/hooks/usePresets';
import { useAppMode } from '@/hooks/useAppMode';
import { PageHeader } from '@/components/layout/PageHeader';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { ModeToggle } from '@/components/settings/ModeToggle';
import { KeyboardShortcuts } from '@/components/settings/KeyboardShortcuts';
import { FocusModeSettings } from '@/components/settings/FocusModeSettings';
import { useAnnounce } from '@/components/Announcer';
import type { Preset } from '@/types';

function PresetEditor({ preset, onSave, onDelete, isDefault, readOnly }: {
  preset: Preset;
  onSave: (p: Preset) => void;
  onDelete?: (id: string) => void;
  isDefault: boolean;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(preset);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(preset);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between p-3 rounded-md border">
        <div>
          <p className="text-sm font-medium">{preset.name}</p>
          <p className="text-xs text-muted-foreground">
            {preset.workMinutes}/{preset.shortBreakMinutes}/{preset.longBreakMinutes} min, {preset.sessionsBeforeLongBreak} sessions
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Edit preset ${preset.name}`}>
              Edit
            </Button>
            {!isDefault && onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(preset.id)} aria-label={`Delete preset ${preset.name}`}>
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-md border space-y-4">
      <div className="space-y-1">
        <label htmlFor="preset-name" className="text-sm text-muted-foreground">Name</label>
        <input
          id="preset-name"
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full px-3 py-1.5 text-sm border rounded-md bg-background text-foreground"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">Work</label>
          <span className="text-sm font-medium tabular-nums">{draft.workMinutes} min</span>
        </div>
        <Slider value={[draft.workMinutes]} onValueChange={([v]) => setDraft({ ...draft, workMinutes: v })} min={1} max={60} step={1} aria-valuetext={`${draft.workMinutes} minutes`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">Short Break</label>
          <span className="text-sm font-medium tabular-nums">{draft.shortBreakMinutes} min</span>
        </div>
        <Slider value={[draft.shortBreakMinutes]} onValueChange={([v]) => setDraft({ ...draft, shortBreakMinutes: v })} min={1} max={30} step={1} aria-valuetext={`${draft.shortBreakMinutes} minutes`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">Long Break</label>
          <span className="text-sm font-medium tabular-nums">{draft.longBreakMinutes} min</span>
        </div>
        <Slider value={[draft.longBreakMinutes]} onValueChange={([v]) => setDraft({ ...draft, longBreakMinutes: v })} min={1} max={60} step={1} aria-valuetext={`${draft.longBreakMinutes} minutes`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">Sessions before long break</label>
          <span className="text-sm font-medium tabular-nums">{draft.sessionsBeforeLongBreak}</span>
        </div>
        <Slider value={[draft.sessionsBeforeLongBreak]} onValueChange={([v]) => setDraft({ ...draft, sessionsBeforeLongBreak: v })} min={1} max={10} step={1} aria-valuetext={`${draft.sessionsBeforeLongBreak} sessions`} />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>Save</Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { presets, savePreset, removePreset } = usePresets();
  const { mode, setMode, isAdvanced } = useAppMode();
  const announce = useAnnounce();

  const handleAddPreset = () => {
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name: 'Custom',
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    };
    savePreset(newPreset);
  };

  return (
    <div>
      <PageHeader title="Settings" description="Customize your timer and preferences." />

      <div className="max-w-lg space-y-8">
        {/* Mode */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Mode</h3>
          <ModeToggle mode={mode} onChange={setMode} />
        </section>

        <Separator />

        {/* Presets */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Presets</h3>
          <div className="space-y-3">
            {presets.map((p) => (
              <PresetEditor
                key={p.id}
                preset={p}
                onSave={savePreset}
                onDelete={removePreset}
                isDefault={p.id === 'default'}
                readOnly={!isAdvanced}
              />
            ))}
          </div>
          {isAdvanced && (
            <Button variant="outline" size="sm" onClick={handleAddPreset}>
              Add Preset
            </Button>
          )}
        </section>

        <Separator />

        {/* Behavior (advanced only) */}
        {isAdvanced && (
          <>
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Behavior</h3>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Auto-start next session
                </label>
                <Switch
                  checked={settings.autoStartNext}
                  onCheckedChange={(checked) => updateSettings({ autoStartNext: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Show remaining time on icon
                </label>
                <Switch
                  checked={settings.showBadge}
                  onCheckedChange={(checked) => updateSettings({ showBadge: checked })}
                />
              </div>
            </section>

            <Separator />
          </>
        )}

        {isAdvanced && (
          <>
            <section className="space-y-4">
              <FocusModeSettings />
            </section>
            <Separator />
          </>
        )}

        {/* Notifications */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Notifications</h3>
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">
              Show notification when timer ends
            </label>
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ notificationsEnabled: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">
              Play sound when timer ends
            </label>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ soundEnabled: checked })
              }
            />
          </div>
          {settings.soundEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Volume</label>
                <span className="text-sm font-medium tabular-nums">
                  {Math.round(settings.soundVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.soundVolume * 100]}
                onValueChange={([v]) =>
                  updateSettings({ soundVolume: v / 100 })
                }
                min={0}
                max={100}
                step={5}
                aria-valuetext={`${Math.round(settings.soundVolume * 100)} percent`}
              />
            </div>
          )}
          {settings.soundEnabled && isAdvanced && (
            <>
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Different sounds per phase
                </label>
                <Switch
                  checked={settings.soundPerPhase}
                  onCheckedChange={(checked) => updateSettings({ soundPerPhase: checked })}
                />
              </div>
              {settings.soundPerPhase && (
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground">Work complete</label>
                    <select
                      value={settings.workCompleteSound}
                      onChange={(e) => updateSettings({ workCompleteSound: e.target.value })}
                      className="text-sm border rounded-md px-2 py-1 bg-background text-foreground"
                      aria-label="Work complete sound"
                    >
                      <option value="default">Default</option>
                      <option value="work">Work Complete</option>
                      <option value="short-break">Short Break</option>
                      <option value="long-break">Long Break</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground">Break complete</label>
                    <select
                      value={settings.breakCompleteSound}
                      onChange={(e) => updateSettings({ breakCompleteSound: e.target.value })}
                      className="text-sm border rounded-md px-2 py-1 bg-background text-foreground"
                      aria-label="Break complete sound"
                    >
                      <option value="default">Default</option>
                      <option value="short-break">Short Break</option>
                      <option value="long-break">Long Break</option>
                      <option value="work">Work Complete</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">
              Show break suggestions
            </label>
            <Switch
              checked={settings.showBreakTips}
              onCheckedChange={(checked) => updateSettings({ showBreakTips: checked })}
            />
          </div>
        </section>

        <Separator />

        {/* Keyboard Shortcuts */}
        <section className="space-y-4">
          <KeyboardShortcuts />
        </section>

        <Separator />

        {/* Theme */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Theme</h3>
          <ThemePicker />
        </section>

        <Separator />

        <Button variant="outline" onClick={() => { resetSettings(); announce('Settings restored to defaults'); }}>
          Restore Defaults
        </Button>
      </div>
    </div>
  );
}
