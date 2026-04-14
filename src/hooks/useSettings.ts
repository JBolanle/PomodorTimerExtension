// Thin wrapper around the settings context. Kept so existing
// `useSettings()` call sites don't change.

export { useSettingsContext as useSettings } from '@/contexts/SettingsContext';
