import { useState, useEffect } from 'react';
import { Keyboard, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutCommand {
  name: string;
  description: string;
  shortcut: string | undefined;
}

function formatCommandName(name: string): string {
  switch (name) {
    case '_execute_action':
    case '_execute_browser_action':
      return 'Open Popup';
    case 'toggle-timer':
      return 'Start / Pause';
    case 'skip-phase':
      return 'Skip Phase';
    default:
      return name;
  }
}

function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.includes('Mac');
  return shortcut
    .replace(/\+/g, ' + ')
    .replace('MacCtrl', '⌃')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Command', '⌘');
}

function openShortcutSettings() {
  if (chrome.runtime.getURL('').startsWith('chrome-extension://')) {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } else {
    chrome.tabs.create({ url: 'about:addons' });
  }
}

export function KeyboardShortcuts() {
  const [commands, setCommands] = useState<ShortcutCommand[]>([]);

  useEffect(() => {
    chrome.commands.getAll().then((allCommands) => {
      setCommands(
        allCommands.map((cmd) => ({
          name: formatCommandName(cmd.name || ''),
          description: cmd.description || '',
          shortcut: cmd.shortcut || undefined,
        }))
      );
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Keyboard className="w-4 h-4" aria-hidden="true" />
          Keyboard Shortcuts
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={openShortcutSettings}
          className="text-xs"
        >
          Customize
          <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-2">
        {commands.map((cmd) => (
          <div
            key={cmd.name}
            className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
          >
            <div>
              <div className="text-sm font-medium">{cmd.name}</div>
              <div className="text-xs text-muted-foreground">
                {cmd.description}
              </div>
            </div>
            <div>
              {cmd.shortcut ? (
                <kbd className="px-2 py-1 text-xs font-mono bg-background border border-border rounded">
                  {formatShortcut(cmd.shortcut)}
                </kbd>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Not set
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Shortcuts work browser-wide, even when the popup is closed.
      </p>
    </div>
  );
}
