// Per-domain Focus Mode overrides: temporary allow + reblock-on-alarm.

import type { OpResult } from '@/shared/types';
import {
  FOCUS_REBLOCK_ALARM_PREFIX,
  FOCUS_REBLOCK_FALLBACK_RULE_ID,
} from '../constants';
import { focusRuleMap, temporaryAllows, timerState } from '../state';
import { focusModeRepo } from '../storage/repos';
import { buildBlockRule, isDomainBlocked } from './controller';

export async function focusAllowOnce(domain: string, minutes = 5): Promise<OpResult> {
  try {
    const ruleId = focusRuleMap.get(domain);
    if (ruleId !== undefined) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
    }
    temporaryAllows.set(domain, { ruleId, expiresAt: Date.now() + minutes * 60000 });
    chrome.alarms.create(`${FOCUS_REBLOCK_ALARM_PREFIX}${domain}`, { delayInMinutes: minutes });
    return { success: true };
  } catch (err) {
    console.error('[Pomodoro] Failed to allow domain:', err);
    return { success: false, error: (err as Error).message };
  }
}

export async function handleFocusReblock(domain: string): Promise<void> {
  const isWorkActive =
    (timerState.state === 'running' || timerState.state === 'paused') &&
    timerState.currentPhase === 'work';

  if (isWorkActive) {
    const settings = await focusModeRepo.get();
    if (isDomainBlocked(domain, settings)) {
      const ruleId = temporaryAllows.get(domain)?.ruleId ?? FOCUS_REBLOCK_FALLBACK_RULE_ID;
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [buildBlockRule(domain, ruleId)],
      });
      focusRuleMap.set(domain, ruleId);
    }
  }
  temporaryAllows.delete(domain);
}
