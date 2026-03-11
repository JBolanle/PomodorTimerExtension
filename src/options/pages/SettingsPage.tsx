import { useSettings } from '@/hooks/useSettings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemePicker } from '@/components/settings/ThemePicker';

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();

  return (
    <div>
      <PageHeader title="Settings" description="Customize your timer and preferences." />

      <div className="max-w-lg space-y-8">
        {/* Timer durations */}
        <section className="space-y-6">
          <h3 className="text-sm font-medium text-foreground">Timer Durations</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Work</label>
              <span className="text-sm font-medium text-foreground tabular-nums">
                {settings.workMinutes} min
              </span>
            </div>
            <Slider
              value={[settings.workMinutes]}
              onValueChange={([v]) => updateSettings({ workMinutes: v })}
              min={1}
              max={60}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Short Break</label>
              <span className="text-sm font-medium text-foreground tabular-nums">
                {settings.shortBreakMinutes} min
              </span>
            </div>
            <Slider
              value={[settings.shortBreakMinutes]}
              onValueChange={([v]) => updateSettings({ shortBreakMinutes: v })}
              min={1}
              max={30}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Long Break</label>
              <span className="text-sm font-medium text-foreground tabular-nums">
                {settings.longBreakMinutes} min
              </span>
            </div>
            <Slider
              value={[settings.longBreakMinutes]}
              onValueChange={([v]) => updateSettings({ longBreakMinutes: v })}
              min={1}
              max={60}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground">Sessions before long break</label>
              <span className="text-sm font-medium text-foreground tabular-nums">
                {settings.sessionsBeforeLongBreak}
              </span>
            </div>
            <Slider
              value={[settings.sessionsBeforeLongBreak]}
              onValueChange={([v]) => updateSettings({ sessionsBeforeLongBreak: v })}
              min={1}
              max={10}
              step={1}
            />
          </div>
        </section>

        <Separator />

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
        </section>

        <Separator />

        {/* Theme */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-foreground">Theme</h3>
          <ThemePicker />
        </section>
      </div>
    </div>
  );
}
