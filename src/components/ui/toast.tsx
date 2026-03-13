import { useState, useCallback, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(({ type, message, duration }: { type: Toast['type']; message: string; duration: number }) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast: ToastContextValue = {
    success: (message: string) => addToast({ type: 'success', message, duration: 4000 }),
    error: (message: string) => addToast({ type: 'error', message, duration: 6000 }),
    info: (message: string) => addToast({ type: 'info', message, duration: 4000 }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed left-2 right-2 bottom-2 z-50 flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} {...toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ type, message, onDismiss }: Toast & { onDismiss: () => void }) {
  const icons = {
    success: <CheckCircle aria-hidden="true" className="w-5 h-5 text-green-500 shrink-0" />,
    error: <AlertCircle aria-hidden="true" className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info aria-hidden="true" className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg shadow-lg border animate-toast-slide-in',
        type === 'error' && 'border-destructive/30 bg-destructive/10',
        type === 'success' && 'border-green-500/30 bg-green-500/10',
        type === 'info' && 'border-blue-500/30 bg-blue-500/10',
      )}
    >
      {icons[type]}
      <p className="flex-1 text-sm text-foreground">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X aria-hidden="true" className="w-4 h-4" />
      </button>
    </div>
  );
}
