import type { Preset, Session } from '@/shared/types';
import { presetsRepo } from '@/lib/storage/client';
import { sessionStore } from '@/lib/sessions/client';

interface ExportData {
  version: number;
  exportedAt: string;
  sessions: Session[];
  presets: Preset[];
}

export interface ImportResult {
  sessionsImported: number;
  presetsImported: number;
  duplicatesSkipped: number;
}

export async function parseImportFile(file: File): Promise<ExportData> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid file format');
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.sessions)) {
    throw new Error('Missing or invalid "sessions" field');
  }

  return {
    version: (obj.version as number) ?? 1,
    exportedAt: (obj.exportedAt as string) ?? '',
    sessions: obj.sessions as Session[],
    presets: Array.isArray(obj.presets) ? (obj.presets as Preset[]) : [],
  };
}

export async function importData(
  data: ExportData,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  if (mode === 'replace') {
    await sessionStore.clear();
    await sessionStore.putMany(data.sessions);
    if (data.presets.length > 0) {
      await presetsRepo.set(data.presets);
    }
    return {
      sessionsImported: data.sessions.length,
      presetsImported: data.presets.length,
      duplicatesSkipped: 0,
    };
  }

  // Merge mode — deduplicate by ID against the current IDB contents.
  const existingSessions = await sessionStore.getAll();
  const existingIds = new Set(existingSessions.map((s) => s.id));
  const newSessions = data.sessions.filter((s) => !existingIds.has(s.id));
  if (newSessions.length > 0) {
    await sessionStore.putMany(newSessions);
  }

  let presetsImported = 0;
  if (data.presets.length > 0) {
    const existingPresets = await presetsRepo.get();
    const existingPresetIds = new Set(existingPresets.map((p) => p.id));
    const newPresets = data.presets.filter((p) => !existingPresetIds.has(p.id));
    if (newPresets.length > 0) {
      await presetsRepo.set([...existingPresets, ...newPresets]);
      presetsImported = newPresets.length;
    }
  }

  return {
    sessionsImported: newSessions.length,
    presetsImported,
    duplicatesSkipped: data.sessions.length - newSessions.length,
  };
}
