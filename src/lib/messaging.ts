export class ExtensionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
  }
}

export function sendMessage<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new ExtensionError(
          chrome.runtime.lastError.message || 'Unable to connect to extension',
          'CONNECTION_ERROR'
        ));
        return;
      }

      if (response === null || response === undefined) {
        reject(new ExtensionError(
          'No response from extension',
          'NO_RESPONSE'
        ));
        return;
      }

      if (typeof response === 'object' && response !== null && 'success' in response && (response as Record<string, unknown>).success === false) {
        reject(new ExtensionError(
          ((response as Record<string, unknown>).error as string) || 'Operation failed',
          ((response as Record<string, unknown>).code as string) || 'OPERATION_FAILED'
        ));
        return;
      }

      resolve(response);
    });
  });
}
