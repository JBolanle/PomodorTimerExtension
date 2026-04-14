// Rehydrate in-memory focus-mode state on SW wake and reconcile it
// against the live `chrome.declarativeNetRequest` snapshot.
//
// Three sources can disagree after a SW restart:
//   1. The in-memory Maps (empty on cold start — that's the bug we fix).
//   2. The persisted Records in storage.
//   3. The dNR dynamic rules actually installed in the browser.
//
// We treat (2) as the starting truth, then prune anything dNR disagrees
// with, handle any temp-allow whose timer expired while the SW was
// asleep, and re-arm alarms for allows that are still pending.

import {
  FOCUS_REBLOCK_ALARM_PREFIX,
  FOCUS_RULE_ID_BASE,
  FOCUS_RULE_ID_MAX,
} from '../constants';
import { focusRuleMap, temporaryAllows } from '../state';
import {
  focusModeRepo,
  focusRuleMapRepo,
  focusTemporaryAllowsRepo,
} from '../storage/repos';
import { buildBlockRule, isDomainBlocked } from './controller';
import { flushFocusRuleMap, flushTemporaryAllows } from './persist';

export async function rehydrateFocusMode(): Promise<void> {
  // (a) Load persisted snapshot into in-memory Maps.
  const [persistedMap, persistedAllows] = await Promise.all([
    focusRuleMapRepo.get(),
    focusTemporaryAllowsRepo.get(),
  ]);

  focusRuleMap.clear();
  for (const [domain, id] of Object.entries(persistedMap)) {
    focusRuleMap.set(domain, id);
  }
  temporaryAllows.clear();
  for (const [domain, entry] of Object.entries(persistedAllows)) {
    temporaryAllows.set(domain, {
      ruleId: entry.ruleId ?? undefined,
      expiresAt: entry.expiresAt,
    });
  }

  // (b) Reconcile with live dNR.
  let mapDirty = false;
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingOurs = existingRules.filter(
    (r) => r.id >= FOCUS_RULE_ID_BASE && r.id < FOCUS_RULE_ID_MAX,
  );
  const existingIds = new Set(existingOurs.map((r) => r.id));

  // Prune map entries whose ruleId isn't in dNR.
  for (const [domain, id] of [...focusRuleMap]) {
    if (!existingIds.has(id)) {
      focusRuleMap.delete(domain);
      mapDirty = true;
    }
  }

  // Remove orphan dNR rules (in our range but absent from the map).
  const keptIds = new Set(focusRuleMap.values());
  const orphanIds = existingOurs
    .map((r) => r.id)
    .filter((id) => !keptIds.has(id));
  if (orphanIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: orphanIds,
      addRules: [],
    });
  }

  // (c) Handle temporary allows: expired → re-block; active → re-arm alarm.
  let allowsDirty = false;
  const now = Date.now();
  const settings = await focusModeRepo.get();

  for (const [domain, entry] of [...temporaryAllows]) {
    if (entry.expiresAt <= now) {
      // Expired while SW was asleep — re-add block rule if still warranted.
      if (isDomainBlocked(domain, settings)) {
        const ruleId = entry.ruleId ?? pickFreshRuleId();
        try {
          await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [ruleId],
            addRules: [buildBlockRule(domain, ruleId)],
          });
          focusRuleMap.set(domain, ruleId);
          mapDirty = true;
        } catch (err) {
          console.error(
            `[Pomodoro] Failed to re-block ${domain} during rehydrate:`,
            err,
          );
        }
      }
      temporaryAllows.delete(domain);
      allowsDirty = true;
      // Clear any stale alarm for this domain too.
      await chrome.alarms
        .clear(`${FOCUS_REBLOCK_ALARM_PREFIX}${domain}`)
        .catch(() => undefined);
    } else {
      // Still active — re-create the alarm (alarms don't survive SW shutdown
      // reliably on all platforms, so be defensive).
      const remainingMin = (entry.expiresAt - now) / 60000;
      const delayInMinutes = Math.max(0.5, remainingMin);
      try {
        await chrome.alarms.create(`${FOCUS_REBLOCK_ALARM_PREFIX}${domain}`, {
          delayInMinutes,
        });
      } catch (err) {
        console.error(
          `[Pomodoro] Failed to re-arm reblock alarm for ${domain}:`,
          err,
        );
      }
    }
  }

  // Persist any reconciliation-driven changes.
  if (mapDirty) await flushFocusRuleMap();
  if (allowsDirty) await flushTemporaryAllows();
}

/** Pick a ruleId outside any currently-used one in the map. Fallback
 *  used when an expired temp-allow entry lost its original ruleId. */
function pickFreshRuleId(): number {
  const used = new Set(focusRuleMap.values());
  for (let id = FOCUS_RULE_ID_BASE + 1; id < FOCUS_RULE_ID_MAX; id++) {
    if (!used.has(id)) return id;
  }
  return FOCUS_RULE_ID_BASE + 1;
}
