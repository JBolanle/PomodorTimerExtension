// Notification sound playback. Chrome uses an offscreen document to
// play audio (SWs can't own <audio>); Firefox plays directly in the
// background script.

import type { Settings, TimerMode } from '@/shared/types';
import { settingsRepo } from '../storage/repos';

const SOUNDS: Record<string, string> = {
  default: 'sounds/notification.mp3',
  work: 'sounds/work-complete.mp3',
  'short-break': 'sounds/short-break-complete.mp3',
  'long-break': 'sounds/long-break-complete.mp3',
};

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  } as chrome.runtime.ContextFilter);
  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK' as chrome.offscreen.Reason],
    justification: 'Play notification sound when timer completes',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

function getSoundForPhase(phase: TimerMode, settings: Settings): string {
  if (!settings.soundPerPhase) return SOUNDS.default;
  if (phase === 'work') {
    return SOUNDS[settings.workCompleteSound] ?? SOUNDS.work;
  }
  // shortBreak + longBreak both use breakCompleteSound
  return SOUNDS[settings.breakCompleteSound] ?? SOUNDS['short-break'];
}

export async function playNotificationSound(phase: TimerMode): Promise<void> {
  try {
    const settings = await settingsRepo.get();
    if (!settings.soundEnabled) return;

    const volume = settings.soundVolume ?? 1.0;
    const soundPath = getSoundForPhase(phase, settings);

    if (chrome.offscreen) {
      // Chrome: offscreen document
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        action: 'playSound',
        sound: soundPath,
        volume,
      });
      return;
    }
    // Firefox path: background script can construct Audio directly
    const audio = new Audio(chrome.runtime.getURL(soundPath));
    audio.volume = volume;
    await audio.play();
  } catch (err) {
    console.error('[Pomodoro] Sound playback failed:', err);
  }
}
