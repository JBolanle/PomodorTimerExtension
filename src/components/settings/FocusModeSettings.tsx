import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { PREDEFINED_BLOCKLISTS } from '@/data/blocklists';
import type { FocusModeSettings } from '@/data/blocklists';

function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  // Strip protocol
  s = s.replace(/^https?:\/\//, '');
  // Strip www.
  s = s.replace(/^www\./, '');
  // Take hostname only (strip path)
  s = s.split('/')[0];
  if (!s) return null;
  return s;
}

export function FocusModeSettings() {
  const [focusSettings, setFocusSettings] = useState<FocusModeSettings | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'getFocusModeSettings' }, (response) => {
      if (response?.settings) {
        setFocusSettings(response.settings);
      }
    });
    chrome.runtime.sendMessage({ action: 'getFocusModeStatus' }, (response) => {
      if (response?.active !== undefined) {
        setIsActive(response.active);
      }
    });
  }, []);

  function persist(updated: FocusModeSettings) {
    setFocusSettings(updated);
    chrome.runtime.sendMessage({ action: 'updateFocusModeSettings', settings: updated });
  }

  function handleMasterToggle(checked: boolean) {
    if (!focusSettings) return;
    persist({ ...focusSettings, enabled: checked });
  }

  function handleCategoryToggle(id: string, checked: boolean) {
    if (!focusSettings) return;
    persist({
      ...focusSettings,
      categories: { ...focusSettings.categories, [id]: checked },
    });
  }

  function handleAddDomain() {
    if (!focusSettings) return;
    const domain = normalizeDomain(customInput);
    if (!domain) {
      setInputError('Enter a valid domain.');
      return;
    }
    if (focusSettings.customDomains.includes(domain)) {
      setInputError('Domain already in list.');
      return;
    }
    setInputError('');
    setCustomInput('');
    persist({ ...focusSettings, customDomains: [...focusSettings.customDomains, domain] });
  }

  function handleRemoveDomain(domain: string) {
    if (!focusSettings) return;
    persist({
      ...focusSettings,
      customDomains: focusSettings.customDomains.filter((d) => d !== domain),
    });
  }

  function handleAllowOnceChange(minutes: number) {
    if (!focusSettings) return;
    persist({ ...focusSettings, allowOnceMinutes: minutes });
  }

  if (!focusSettings) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium text-foreground">Focus Mode</h3>
        {isActive && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Active
          </span>
        )}
      </div>

      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">
          Block distracting sites during work sessions
        </label>
        <Switch
          checked={focusSettings.enabled}
          onCheckedChange={handleMasterToggle}
        />
      </div>

      {focusSettings.enabled && (
        <div className="space-y-4 pl-2 border-l-2 border-muted">
          {/* Category toggles */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Categories
            </p>
            {PREDEFINED_BLOCKLISTS.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                  </div>
                </div>
                <Switch
                  checked={focusSettings.categories[cat.id] ?? false}
                  onCheckedChange={(checked) => handleCategoryToggle(cat.id, checked)}
                />
              </div>
            ))}
          </div>

          {/* Custom domains */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Custom Domains
            </p>
            {focusSettings.customDomains.length > 0 && (
              <div className="space-y-1">
                {focusSettings.customDomains.map((domain) => (
                  <div key={domain} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                    <span className="text-sm text-foreground">{domain}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemoveDomain(domain)}
                      aria-label={`Remove ${domain}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => {
                  setCustomInput(e.target.value);
                  if (inputError) setInputError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddDomain();
                }}
                placeholder="e.g. example.com"
                aria-label="Custom domain to block"
                aria-describedby={inputError ? 'custom-domain-error' : undefined}
                className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button variant="outline" size="sm" onClick={handleAddDomain} aria-label="Add custom domain">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {inputError && (
              <p id="custom-domain-error" className="text-xs text-destructive" aria-live="polite">{inputError}</p>
            )}
          </div>

          {/* Allow Once duration */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Allow Once duration</p>
              <p className="text-xs text-muted-foreground">Temporarily unblock a site for this long</p>
            </div>
            <select
              value={focusSettings.allowOnceMinutes}
              onChange={(e) => handleAllowOnceChange(Number(e.target.value))}
              aria-label="Allow once duration"
              className="text-sm border rounded-md px-2 py-1 bg-background text-foreground"
            >
              <option value={1}>1 min</option>
              <option value={3}>3 min</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
