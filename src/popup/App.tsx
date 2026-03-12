import { useCallback, useEffect, useState } from 'react';
import { useTimerState } from '@/hooks/useTimerState';
import { useTheme } from '@/hooks/useTheme';
import { usePresets } from '@/hooks/usePresets';
import { useSettings } from '@/hooks/useSettings';
import { useAppMode } from '@/hooks/useAppMode';
import { usePopupShortcuts } from '@/hooks/usePopupShortcuts';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { PresetSelector } from '@/components/timer/PresetSelector';
import { TimerControls } from '@/components/timer/TimerControls';
import { SessionDots } from '@/components/timer/SessionDots';
import { BreakTipDisplay } from '@/components/timer/BreakTip';
import { StartSessionModal } from '@/components/timer/StartSessionModal';
import { CurrentSessionMeta } from '@/components/timer/CurrentSessionMeta';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { THEMES, THEME_META } from '@/lib/constants';

const PHASE_LABELS = {
  work: 'Work',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
} as const;

export default function App() {
  const {
    state: timerState,
    currentPhase,
    workSessionsCompleted,
    suggestedNext,
    remainingSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    skipPhase,
    endActivity,
    startNext,
  } = useTimerState();

  const { theme, setTheme } = useTheme();
  const { presets, activePreset, activePresetId, selectPreset } = usePresets();
  const { settings } = useSettings();
  const { isAdvanced } = useAppMode();
  const [showStartModal, setShowStartModal] = useState(false);
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [focusModeEnabled, setFocusModeEnabled] = useState(true);

  useEffect(() => {
    if (isAdvanced) {
      chrome.runtime.sendMessage({ action: 'getFocusModeSettings' })
        .then(res => setFocusModeEnabled(res?.settings?.enabled ?? true))
        .catch(() => {});
    }
  }, [isAdvanced]);

  useEffect(() => {
    if ((timerState === 'running' || timerState === 'paused') && currentPhase === 'work') {
      chrome.runtime.sendMessage({ action: 'getFocusModeStatus' })
        .then(res => setFocusModeActive(res?.active ?? false))
        .catch(() => setFocusModeActive(false));
    } else {
      setFocusModeActive(false);
    }
  }, [timerState, currentPhase]);

  const showBreakTip = settings.showBreakTips &&
    (currentPhase === 'shortBreak' || currentPhase === 'longBreak') &&
    (timerState === 'running' || timerState === 'paused' || timerState === 'transition');

  const showSessionMeta = isAdvanced &&
    (timerState === 'running' || timerState === 'paused') &&
    currentPhase === 'work';

  const handleStart = useCallback(() => {
    if (isAdvanced) {
      setShowStartModal(true);
    } else {
      startTimer('work', activePreset.workMinutes, false);
    }
  }, [isAdvanced, activePreset, startTimer]);

  const handleStartWithMeta = useCallback(async (note: string, tags: string[]) => {
    await chrome.runtime.sendMessage({ action: 'setSessionMeta', note, tags }).catch(() => {});
    startTimer('work', activePreset.workMinutes, focusModeEnabled);
    setShowStartModal(false);
  }, [activePreset, startTimer, focusModeEnabled]);

  const handleStartWithoutMeta = useCallback(() => {
    startTimer('work', activePreset.workMinutes, focusModeEnabled);
    setShowStartModal(false);
  }, [activePreset, startTimer, focusModeEnabled]);

  const handleStartNext = useCallback(() => {
    startNext();
  }, [startNext]);

  const handleToggle = useCallback(() => {
    if (timerState === 'running') pauseTimer();
    else if (timerState === 'paused') resumeTimer();
    else if (timerState === 'idle') handleStart();
    else if (timerState === 'transition') startNext();
  }, [timerState, pauseTimer, resumeTimer, handleStart, startNext]);

  usePopupShortcuts({
    onToggle: handleToggle,
    onSkip: skipPhase,
    onReset: endActivity,
  });

  const cycleTheme = useCallback(() => {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);
  }, [theme, setTheme]);

  const handleOpenSettings = useCallback(() => {
    if (chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  }, []);

  return (
    <div className="w-[350px] p-6 flex flex-col items-center gap-4">
      {timerState === 'idle' && (
        <PresetSelector
          presets={presets}
          activePresetId={activePresetId}
          onSelect={selectPreset}
          disabled={false}
        />
      )}

      {timerState === 'transition' && (
        <p className="text-sm text-muted-foreground text-center">
          {PHASE_LABELS[currentPhase]} complete! Up next: {suggestedNext ? PHASE_LABELS[suggestedNext] : 'Work'}
        </p>
      )}

      {(timerState === 'running' || timerState === 'paused') && (
        <p className="text-sm font-medium text-foreground">
          {PHASE_LABELS[currentPhase]}
        </p>
      )}

      <TimerDisplay
        remainingSeconds={remainingSeconds}
        mode={currentPhase}
        timerState={timerState}
        activePreset={activePreset}
        suggestedNext={suggestedNext}
      />

      <CurrentSessionMeta visible={showSessionMeta} />

      <BreakTipDisplay visible={showBreakTip} />

      {focusModeActive && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
          <span className="text-xs text-green-500 font-medium">Focus Mode</span>
        </div>
      )}

      <TimerControls
        timerState={timerState}
        suggestedNext={suggestedNext}
        onStart={handleStart}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onSkip={skipPhase}
        onEndActivity={endActivity}
        onStartNext={handleStartNext}
      />

      <SessionDots
        completedSessions={workSessionsCompleted}
        total={activePreset.sessionsBeforeLongBreak}
      />

      <Separator className="my-1" />

      <footer className="w-full flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleTheme}
            className="text-xs text-muted-foreground"
          >
            {THEME_META[theme].label}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenSettings}
            className="text-xs text-muted-foreground"
          >
            Settings
          </Button>
        </div>
        <span className="text-[10px] text-muted-foreground/50 text-center">
          Space: start/pause &middot; S: skip &middot; R: reset &middot; Esc: close
        </span>
      </footer>

      {showStartModal && (
        <StartSessionModal
          presetName={activePreset.name}
          duration={activePreset.workMinutes}
          focusModeEnabled={focusModeEnabled}
          onFocusModeChange={setFocusModeEnabled}
          onStart={handleStartWithMeta}
          onSkip={handleStartWithoutMeta}
          onCancel={() => setShowStartModal(false)}
        />
      )}
    </div>
  );
}
