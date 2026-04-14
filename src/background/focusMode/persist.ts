// Persistence helpers for focus-mode in-memory Maps. Every mutation of
// `focusRuleMap` / `temporaryAllows` goes through one of these so the
// on-disk snapshot stays in lockstep and survives a SW restart.
//
// The in-memory representation stays as `Map<string, …>` for ergonomics;
// the on-disk form is a `Record` (maps aren't JSON-serializable). Writes
// are fire-and-forget — errors are logged but do not block callers.

import { focusRuleMap, temporaryAllows } from '../state';
import {
  focusRuleMapRepo,
  focusTemporaryAllowsRepo,
} from '../storage/repos';
import type { FocusTemporaryAllowPersisted } from '@/shared/schema';

function logPersistError(scope: string, err: unknown): void {
  console.error(`[Pomodoro] Failed to persist ${scope}:`, err);
}

function serializeRuleMap(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [domain, id] of focusRuleMap) out[domain] = id;
  return out;
}

function serializeTempAllows(): Record<string, FocusTemporaryAllowPersisted> {
  const out: Record<string, FocusTemporaryAllowPersisted> = {};
  for (const [domain, entry] of temporaryAllows) {
    out[domain] = {
      ruleId: entry.ruleId ?? null,
      expiresAt: entry.expiresAt,
    };
  }
  return out;
}

function persistRuleMap(): void {
  void focusRuleMapRepo
    .set(serializeRuleMap())
    .catch((err) => logPersistError('focusRuleMap', err));
}

function persistTempAllows(): void {
  void focusTemporaryAllowsRepo
    .set(serializeTempAllows())
    .catch((err) => logPersistError('focusTemporaryAllows', err));
}

// --- focusRuleMap helpers ---

export function setFocusRule(domain: string, id: number): void {
  focusRuleMap.set(domain, id);
  persistRuleMap();
}

export function deleteFocusRule(domain: string): void {
  focusRuleMap.delete(domain);
  persistRuleMap();
}

export function clearFocusRules(): void {
  focusRuleMap.clear();
  persistRuleMap();
}

/** Replace the entire rule map (used by enableFocusMode's bulk rebuild). */
export function replaceFocusRules(entries: Iterable<[string, number]>): void {
  focusRuleMap.clear();
  for (const [domain, id] of entries) focusRuleMap.set(domain, id);
  persistRuleMap();
}

// --- temporaryAllows helpers ---

export function setTemporaryAllow(
  domain: string,
  entry: { ruleId: number | undefined; expiresAt: number },
): void {
  temporaryAllows.set(domain, entry);
  persistTempAllows();
}

export function deleteTemporaryAllow(domain: string): void {
  temporaryAllows.delete(domain);
  persistTempAllows();
}

export function clearTemporaryAllows(): void {
  temporaryAllows.clear();
  persistTempAllows();
}

// --- Awaitable variants for rehydrate, where callers want to confirm
//     the write before returning (keeps reconciliation atomic-ish). ---

export async function flushFocusRuleMap(): Promise<void> {
  try {
    await focusRuleMapRepo.set(serializeRuleMap());
  } catch (err) {
    logPersistError('focusRuleMap', err);
  }
}

export async function flushTemporaryAllows(): Promise<void> {
  try {
    await focusTemporaryAllowsRepo.set(serializeTempAllows());
  } catch (err) {
    logPersistError('focusTemporaryAllows', err);
  }
}
