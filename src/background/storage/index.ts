// Barrel for the storage layer. Consumers (SW in Phase 3, React via
// `src/lib/storage/client.ts` today) should import from here, not from
// the individual files.

export { StorageAdapter } from './adapter';
export { STORAGE_DEFAULTS } from './schema';
export { MIGRATIONS, runMigrations, type Migration } from './migrations';
export {
  currentSessionRepo,
  focusModeRepo,
  presetsRepo,
  sessionHistoryRepo,
  settingsRepo,
  tagHistoryRepo,
  themeRepo,
  timerStateRepo,
} from './repos';
