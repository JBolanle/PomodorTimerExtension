// Phase 7 coverage — focusAllowOnce / handleFocusReblock (ruleManager.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMocks,
  installChromeMocks,
  uninstallChromeMocks,
} from './chromeMocks';

const FOCUS_RULE_ID_BASE = 10000;

async function loadModules() {
  vi.resetModules();
  const state = await import('@/background/state');
  const controller = await import('@/background/focusMode/controller');
  const ruleManager = await import('@/background/focusMode/ruleManager');
  const persist = await import('@/background/focusMode/persist');
  return { ...state, ...controller, ...ruleManager, ...persist };
}

beforeEach(() => {
  installChromeMocks();
  // Seed a default focusModeSettings so isDomainBlocked has something to
  // consult during the reblock path.
  const mocks = getMocks();
  mocks.storage.set('focusModeSettings', {
    enabled: true,
    categories: { social: true, video: false, news: false, shopping: false, gaming: false },
    customDomains: ['custom.example'],
    allowOnceMinutes: 5,
  });
});

afterEach(() => {
  uninstallChromeMocks();
});

describe('focusAllowOnce', () => {
  it('removes the active block rule, records the temp-allow, and arms a reblock alarm', async () => {
    const { focusAllowOnce, focusRuleMap, temporaryAllows } = await loadModules();
    const mocks = getMocks();

    // Simulate a domain currently being blocked by rule 10005.
    focusRuleMap.set('facebook.com', FOCUS_RULE_ID_BASE + 5);
    mocks.dnrRules.push({
      id: FOCUS_RULE_ID_BASE + 5,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html' } },
      condition: { urlFilter: '||facebook.com', resourceTypes: ['main_frame'] },
    });

    const result = await focusAllowOnce('facebook.com', 5);

    expect(result.success).toBe(true);
    expect(focusRuleMap.has('facebook.com')).toBe(false);
    expect(mocks.dnrRules.some((r) => r.id === FOCUS_RULE_ID_BASE + 5)).toBe(false);
    expect(temporaryAllows.get('facebook.com')?.ruleId).toBe(FOCUS_RULE_ID_BASE + 5);
    expect(mocks.alarms.has('focus-reblock-facebook.com')).toBe(true);
  });

  it('still sets the temp-allow when there is no active block rule', async () => {
    const { focusAllowOnce, temporaryAllows } = await loadModules();
    const result = await focusAllowOnce('never-blocked.example', 1);
    expect(result.success).toBe(true);
    expect(temporaryAllows.get('never-blocked.example')?.ruleId).toBeUndefined();
  });
});

describe('handleFocusReblock', () => {
  it('re-blocks an expired domain while work is active', async () => {
    const {
      handleFocusReblock,
      focusRuleMap,
      temporaryAllows,
      assignTimerState,
    } = await loadModules();
    const mocks = getMocks();

    assignTimerState({ state: 'running', currentPhase: 'work' });
    temporaryAllows.set('facebook.com', {
      ruleId: FOCUS_RULE_ID_BASE + 7,
      expiresAt: Date.now() - 1,
    });

    await handleFocusReblock('facebook.com');

    expect(temporaryAllows.has('facebook.com')).toBe(false);
    expect(focusRuleMap.get('facebook.com')).toBe(FOCUS_RULE_ID_BASE + 7);
    expect(mocks.dnrRules.some((r) => r.id === FOCUS_RULE_ID_BASE + 7)).toBe(true);
  });

  it('does not re-block when work is not active (e.g. during a break)', async () => {
    const {
      handleFocusReblock,
      focusRuleMap,
      temporaryAllows,
      assignTimerState,
    } = await loadModules();
    const mocks = getMocks();

    assignTimerState({ state: 'running', currentPhase: 'shortBreak' });
    temporaryAllows.set('facebook.com', {
      ruleId: undefined,
      expiresAt: Date.now() - 1,
    });

    await handleFocusReblock('facebook.com');

    expect(temporaryAllows.has('facebook.com')).toBe(false);
    expect(focusRuleMap.has('facebook.com')).toBe(false);
    expect(mocks.dnrRules).toHaveLength(0);
  });

  it('drops the temp-allow but does not re-block if the domain is no longer on the blocklist', async () => {
    const {
      handleFocusReblock,
      focusRuleMap,
      temporaryAllows,
      assignTimerState,
    } = await loadModules();
    const mocks = getMocks();

    assignTimerState({ state: 'running', currentPhase: 'work' });
    temporaryAllows.set('benign.example', {
      ruleId: undefined,
      expiresAt: Date.now() - 1,
    });

    await handleFocusReblock('benign.example');
    expect(temporaryAllows.has('benign.example')).toBe(false);
    expect(focusRuleMap.has('benign.example')).toBe(false);
    expect(mocks.dnrRules).toHaveLength(0);
  });
});
