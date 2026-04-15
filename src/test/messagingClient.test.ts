// Phase 7 coverage — React-side typed messaging client.
//
// Tests exercise each branch independently of the SW by stubbing
// `chrome.runtime.sendMessage` to invoke the callback synchronously
// with the scenario under test.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExtensionError, sendMessage } from '@/lib/messaging/client';

type Callback = (response: unknown) => void;

function installRuntime(respond: (msg: unknown, cb: Callback) => void, lastError?: { message: string }) {
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: (msg: unknown, cb: Callback) => respond(msg, cb),
      lastError,
    },
  };
}

afterEach(() => {
  delete (globalThis as any).chrome;
});

describe('sendMessage (typed client)', () => {
  it('resolves with the response on success', async () => {
    installRuntime((_msg, cb) => cb({ state: 'idle' }));
    const result = await sendMessage('getState');
    expect(result).toEqual({ state: 'idle' });
  });

  it('forwards payload into the outgoing message', async () => {
    let captured: unknown;
    installRuntime((msg, cb) => {
      captured = msg;
      cb({ success: true });
    });
    await sendMessage('startTimer', { phase: 'work', minutes: 25, focusMode: false });
    expect(captured).toEqual({
      action: 'startTimer',
      phase: 'work',
      minutes: 25,
      focusMode: false,
    });
  });

  it('rejects with CONNECTION_ERROR when chrome.runtime.lastError is set', async () => {
    installRuntime((_msg, cb) => cb(undefined), { message: 'Port closed before response' });
    await expect(sendMessage('getState')).rejects.toMatchObject({
      code: 'CONNECTION_ERROR',
    });
  });

  it('rejects with NO_RESPONSE when the SW returns nothing', async () => {
    installRuntime((_msg, cb) => cb(undefined));
    await expect(sendMessage('getState')).rejects.toMatchObject({ code: 'NO_RESPONSE' });
  });

  it('rejects with the error code the SW returned on { success: false }', async () => {
    installRuntime((_msg, cb) =>
      cb({ success: false, error: 'No such preset', code: 'NOT_FOUND' }),
    );
    await expect(sendMessage('setActivePreset', { presetId: 'nope' })).rejects.toMatchObject({
      message: 'No such preset',
      code: 'NOT_FOUND',
    });
  });

  it('wraps thrown rejections in ExtensionError', async () => {
    installRuntime((_msg, cb) => cb(null));
    try {
      await sendMessage('getState');
      throw new Error('should have rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(ExtensionError);
    }
  });
});
