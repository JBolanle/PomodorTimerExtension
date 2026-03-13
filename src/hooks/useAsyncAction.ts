import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/toast';
import { formatError } from '@/lib/errorMessages';

interface UseAsyncActionOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: unknown) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export function useAsyncAction<T>(
  action: (...args: unknown[]) => Promise<T>,
  options: UseAsyncActionOptions<T> = {},
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const actionRef = useRef(action);
  actionRef.current = action;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const execute = useCallback(async (...args: unknown[]): Promise<T | undefined> => {
    setLoading(true);
    setError(null);

    const opts = optionsRef.current;

    try {
      const result = await actionRef.current(...args);

      if (opts.showSuccessToast && opts.successMessage) {
        toast.success(opts.successMessage);
      }

      opts.onSuccess?.(result);
      return result;
    } catch (err) {
      const message = opts.errorMessage || formatError(err);
      setError(message);

      if (opts.showErrorToast !== false) {
        toast.error(message);
      }

      opts.onError?.(err);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const clearError = useCallback(() => setError(null), []);

  return { execute, loading, error, clearError };
}
