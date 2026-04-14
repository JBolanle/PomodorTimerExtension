// Typed messaging client for the React side. Replaces the loosely-typed
// `sendMessage(action: string, payload)` helper. Same runtime behavior —
// `chrome.runtime.sendMessage` under the hood, same `ExtensionError`
// rejection paths — but the action discriminator and payload must now
// match `MessageMap`.

import type {
  MessageAction,
  MessageRequest,
  MessageResponse,
} from '@/shared/types';

// The client rejects whenever the SW responds with `{ success: false }`,
// so callers only ever observe the success branch of `OpResult`. This
// narrows the resolved type accordingly.
type Resolved<T> = T extends { success: false }
  ? Exclude<T, { success: false }>
  : T;

export class ExtensionError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
  }
}

// Actions whose request payload has no required fields (either empty or
// all-optional). For these the caller may omit the payload argument.
// Note: `keyof Record<string, never>` is `string`, not `never`, so we
// use `{} extends T` to detect "no required keys" structurally.
type EmptyRequestAction = {
  [K in MessageAction]: Record<string, never> extends MessageRequest<K>
    ? K
    : never;
}[MessageAction];

export function sendMessage<K extends EmptyRequestAction>(
  action: K,
): Promise<Resolved<MessageResponse<K>>>;
export function sendMessage<K extends MessageAction>(
  action: K,
  payload: MessageRequest<K>,
): Promise<Resolved<MessageResponse<K>>>;
export function sendMessage<K extends MessageAction>(
  action: K,
  payload?: MessageRequest<K>,
): Promise<Resolved<MessageResponse<K>>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action, ...(payload ?? {}) },
      (response: MessageResponse<K> | undefined) => {
        const resolveTyped = resolve as (value: Resolved<MessageResponse<K>>) => void;
        if (chrome.runtime.lastError) {
          reject(
            new ExtensionError(
              chrome.runtime.lastError.message || 'Unable to connect to extension',
              'CONNECTION_ERROR',
            ),
          );
          return;
        }

        if (response === null || response === undefined) {
          reject(new ExtensionError('No response from extension', 'NO_RESPONSE'));
          return;
        }

        if (
          typeof response === 'object' &&
          response !== null &&
          'success' in response &&
          (response as { success: unknown }).success === false
        ) {
          const err = response as { error?: string; code?: string };
          reject(
            new ExtensionError(
              err.error || 'Operation failed',
              err.code || 'OPERATION_FAILED',
            ),
          );
          return;
        }

        resolveTyped(response as Resolved<MessageResponse<K>>);
      },
    );
  });
}
