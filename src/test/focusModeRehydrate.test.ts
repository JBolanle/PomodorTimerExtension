// Phase 6 — focus mode persistence tests.
//
// Exercises `rehydrateFocusMode()` directly rather than going through the
// full SW boot: the boot path also fires `enableFocusMode()` /
// `disableFocusMode()` for work-phase recovery, which would rewrite the
// rehydrated state and obscure what we're asserting.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMocks,
  installChromeMocks,
  uninstallChromeMocks,
} from './chromeMocks';

const FOCUS_RULE_ID_BASE = 10000;

// Fresh module graph per test so the focusRuleMap / temporaryAllows
// singletons start empty (simulating a cold SW boot).
async function loadRehydrate() {
  vi.resetModules();
  const mod = await import('../background/focusMode/rehydrate');
  const state = await import('../background/state');
  return { rehydrateFocusMode: mod.rehydrateFocusMode, ...state };
}

beforeEach(() => {
  installChromeMocks();
});

afterEach(() => {
  uninstallChromeMocks();
});

describe('rehydrateFocusMode', () => {
  it('restores in-memory Maps from persisted Records and keeps matching dNR rules', async () => {
    const ruleId = FOCUS_RULE_ID_BASE + 42;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const mocks = getMocks();

    mocks.storage.set('focusRuleMap', { 'example.com': ruleId });
    mocks.storage.set('focusTemporaryAllows', {
      'facebook.com': { ruleId: null, expiresAt },
    });
    mocks.dnrRules.push({
      id: ruleId,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html' } },
      condition: { urlFilter: '||example.com', resourceTypes: ['main_frame'] },
    });

    const { rehydrateFocusMode, focusRuleMap, temporaryAllows } =
      await loadRehydrate();
    await rehydrateFocusMode();

    expect(focusRuleMap.get('example.com')).toBe(ruleId);
    expect(temporaryAllows.has('facebook.com')).toBe(true);
    expect(temporaryAllows.get('facebook.com')?.expiresAt).toBe(expiresAt);

    // The live dNR rule was preserved.
    expect(mocks.dnrRules.some((r) => r.id === ruleId)).toBe(true);

    // A reblock alarm was re-armed for the still-active temp allow.
    expect(mocks.alarms.has('focus-reblock-facebook.com')).toBe(true);
  });

  it('prunes map entries whose rule is missing from dNR and re-persists', async () => {
    const mocks = getMocks();
    mocks.storage.set('focusRuleMap', {
      'example.com': FOCUS_RULE_ID_BASE + 1,
    });
    // dNR is empty — persisted rule is orphaned.

    const { rehydrateFocusMode, focusRuleMap } = await loadRehydrate();
    await rehydrateFocusMode();

    expect(focusRuleMap.size).toBe(0);
    expect(mocks.storage.get('focusRuleMap')).toEqual({});
  });

  it('removes orphan dNR rules in our range that the map does not know about', async () => {
    const orphanId = FOCUS_RULE_ID_BASE + 77;
    const mocks = getMocks();
    mocks.storage.set('focusRuleMap', {});
    mocks.dnrRules.push({
      id: orphanId,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html' } },
      condition: { urlFilter: '||orphan.example', resourceTypes: ['main_frame'] },
    });

    const { rehydrateFocusMode } = await loadRehydrate();
    await rehydrateFocusMode();

    expect(mocks.dnrRules.some((r) => r.id === orphanId)).toBe(false);
  });

  it('re-blocks a domain whose temp-allow expired while the SW slept', async () => {
    const pastExpiry = Date.now() - 60 * 1000;
    const mocks = getMocks();

    // facebook.com belongs to the default-enabled "social" blocklist.
    mocks.storage.set('focusRuleMap', {});
    mocks.storage.set('focusTemporaryAllows', {
      'facebook.com': { ruleId: null, expiresAt: pastExpiry },
    });

    const { rehydrateFocusMode, focusRuleMap, temporaryAllows } =
      await loadRehydrate();
    await rehydrateFocusMode();

    // Expired entry removed; domain re-blocked via a fresh rule.
    expect(temporaryAllows.has('facebook.com')).toBe(false);
    expect(focusRuleMap.has('facebook.com')).toBe(true);

    expect(mocks.dnrRules.length).toBe(1);
    expect(mocks.dnrRules[0].condition.urlFilter).toContain('facebook.com');

    // Persisted records reflect the reconciliation.
    expect(mocks.storage.get('focusTemporaryAllows')).toEqual({});
    const persistedMap = mocks.storage.get('focusRuleMap') as Record<
      string,
      number
    >;
    expect(Object.keys(persistedMap)).toContain('facebook.com');
  });
});
