import type { SessionRecord, Preset } from '@/types';
import { getStorage, setStorage } from '@/lib/storage';

interface ExportData {
  version: number;
  exportedAt: string;
  sessions: SessionRecord[];
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
    sessions: obj.sessions as SessionRecord[],
    presets: Array.isArray(obj.presets) ? (obj.presets as Preset[]) : [],
  };
}

export async function importData(
  data: ExportData,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  if (mode === 'replace') {
    await setStorage('sessionHistory', data.sessions);
    if (data.presets.length > 0) {
      await setStorage('presets', data.presets);
    }
    return {
      sessionsImported: data.sessions.length,
      presetsImported: data.presets.length,
      duplicatesSkipped: 0,
    };
  }

  // Merge mode — deduplicate by ID
  const existingSessions = await getStorage<SessionRecord[]>('sessionHistory', []);
  const existingIds = new Set(existingSessions.map((s) => s.id));
  const newSessions = data.sessions.filter((s) => !existingIds.has(s.id));
  const merged = [...existingSessions, ...newSessions];
  await setStorage('sessionHistory', merged);

  let presetsImported = 0;
  if (data.presets.length > 0) {
    const existingPresets = await getStorage<Preset[]>('presets', []);
    const existingPresetIds = new Set(existingPresets.map((p) => p.id));
    const newPresets = data.presets.filter((p) => !existingPresetIds.has(p.id));
    if (newPresets.length > 0) {
      await setStorage('presets', [...existingPresets, ...newPresets]);
      presetsImported = newPresets.length;
    }
  }

  return {
    sessionsImported: newSessions.length,
    presetsImported,
    duplicatesSkipped: data.sessions.length - newSessions.length,
  };
}
