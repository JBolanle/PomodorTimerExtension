import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { parseImportFile, importData, type ImportResult } from '@/lib/import';

type Step = 'select' | 'preview' | 'importing' | 'result';

interface ParsedData {
  version: number;
  exportedAt: string;
  sessions: { id: string }[];
  presets: { id: string; name: string }[];
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('select');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseImportFile(file);
      setParsed(data);
      setError(null);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setStep('importing');
    try {
      const res = await importData(parsed as Parameters<typeof importData>[0], mode);
      setResult(res);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Import Data</h2>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a previously exported JSON backup file.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="font-medium">{parsed.sessions.length}</span> sessions</p>
              <p><span className="font-medium">{parsed.presets.length}</span> presets</p>
              {parsed.exportedAt && (
                <p className="text-muted-foreground">
                  Exported: {new Date(parsed.exportedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Import mode</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                  />
                  Merge (skip duplicates)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                  />
                  Replace all
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleImport}>Import</Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <p className="text-sm text-muted-foreground">Importing...</p>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p>{result.sessionsImported} sessions imported</p>
              <p>{result.presetsImported} presets imported</p>
              {result.duplicatesSkipped > 0 && (
                <p className="text-muted-foreground">{result.duplicatesSkipped} duplicates skipped</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
