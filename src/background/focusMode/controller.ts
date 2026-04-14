// Focus Mode controller: translates FocusModeSettings into
// declarativeNetRequest dynamic rules. The on-disk settings live in
// `focusModeRepo`; the in-memory rule map lives in `state.focusRuleMap`.

import { PREDEFINED_BLOCKLISTS } from '@/data/blocklists';
import type { FocusModeSettings } from '@/shared/types';
import { FOCUS_RULE_ID_BASE, FOCUS_RULE_ID_MAX } from '../constants';
import { focusModeRepo } from '../storage/repos';
import {
  clearFocusRules,
  clearTemporaryAllows,
  replaceFocusRules,
} from './persist';

const BLOCKLIST_DOMAINS: Record<string, string[]> = Object.fromEntries(
  PREDEFINED_BLOCKLISTS.map((c) => [c.id, c.domains]),
);

export function generateBlockedDomains(settings: FocusModeSettings): string[] {
  const domains: string[] = [];
  for (const [categoryId, categoryDomains] of Object.entries(BLOCKLIST_DOMAINS)) {
    if (settings.categories[categoryId]) {
      domains.push(...categoryDomains);
    }
  }
  domains.push(...(settings.customDomains ?? []));
  return [...new Set(domains)];
}

export function isDomainBlocked(domain: string, settings: FocusModeSettings): boolean {
  if ((settings.customDomains ?? []).includes(domain)) return true;
  for (const [categoryId, domains] of Object.entries(BLOCKLIST_DOMAINS)) {
    if (settings.categories[categoryId] && domains.includes(domain)) return true;
  }
  return false;
}

function buildBlockRule(domain: string, ruleId: number): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      redirect: { extensionPath: '/blocked/blocked.html' },
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  };
}

async function currentFocusRuleIds(): Promise<number[]> {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  return existing
    .filter((r) => r.id >= FOCUS_RULE_ID_BASE && r.id < FOCUS_RULE_ID_MAX)
    .map((r) => r.id);
}

export async function enableFocusMode(): Promise<void> {
  try {
    const settings = await focusModeRepo.get();
    if (!settings.enabled) return;

    const domains = generateBlockedDomains(settings);
    if (domains.length === 0) return;

    const rules: chrome.declarativeNetRequest.Rule[] = [];
    const newEntries: [string, number][] = [];
    domains.forEach((domain, i) => {
      const ruleId = FOCUS_RULE_ID_BASE + 1 + i;
      newEntries.push([domain, ruleId]);
      rules.push(buildBlockRule(domain, ruleId));
    });
    replaceFocusRules(newEntries);

    const removeRuleIds = await currentFocusRuleIds();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
  } catch (err) {
    console.error('[Pomodoro] Failed to enable focus mode:', err);
  }
}

export async function disableFocusMode(): Promise<void> {
  try {
    const removeRuleIds = await currentFocusRuleIds();
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: [],
      });
    }
    const alarms = await chrome.alarms.getAll();
    for (const alarm of alarms) {
      if (alarm.name.startsWith('focus-reblock-')) {
        await chrome.alarms.clear(alarm.name);
      }
    }
    clearFocusRules();
    clearTemporaryAllows();
  } catch (err) {
    console.error('[Pomodoro] Failed to disable focus mode:', err);
  }
}

export { buildBlockRule };
