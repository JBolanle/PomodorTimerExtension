import type { Session, Preset } from '@/types';

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

export function exportToJSON(sessions: Session[], presets: Preset[]) {
  const data = {
    version: 2,
    exportedAt: new Date().toISOString(),
    sessions,
    presets,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `pomodoro-backup-${date}.json`);
}

export function exportToCSV(sessions: Session[]) {
  const headers = ['session_id', 'started_at', 'ended_at', 'status', 'total_focus_min', 'total_break_min', 'work_count', 'break_count'];
  const rows = sessions.map((s) => [
    s.id,
    new Date(s.startedAt).toISOString(),
    s.endedAt ? new Date(s.endedAt).toISOString() : '',
    s.status,
    (s.totalFocusMs / 60000).toFixed(1),
    (s.totalBreakMs / 60000).toFixed(1),
    s.phases.filter(p => p.mode === 'work').length,
    s.phases.filter(p => p.mode !== 'work').length,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `pomodoro-sessions-${date}.csv`);
}
