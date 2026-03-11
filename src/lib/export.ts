import type { SessionRecord, Preset } from '@/types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToJSON(sessions: SessionRecord[], presets: Preset[]) {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    presets,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `pomodoro-backup-${date}.json`);
}

export function exportToCSV(sessions: SessionRecord[]) {
  const headers = ['id', 'mode', 'planned_duration_min', 'actual_duration_min', 'completion_type', 'completed_at'];
  const rows = sessions.map((s) => [
    s.id,
    s.mode,
    (s.plannedDurationMs / 60000).toFixed(1),
    (s.actualDurationMs / 60000).toFixed(1),
    s.completionType,
    new Date(s.completedAt).toISOString(),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `pomodoro-sessions-${date}.csv`);
}
