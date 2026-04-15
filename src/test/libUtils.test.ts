// Phase 7 coverage — tiny pure utilities in `src/lib/`.

import { describe, expect, it } from 'vitest';
import { cn, formatTime } from '@/lib/utils';
import { formatError, getUserMessage } from '@/lib/errorMessages';

describe('formatTime', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9)).toBe('00:09');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(25 * 60)).toBe('25:00');
  });
});

describe('cn', () => {
  it('merges class names and resolves tailwind conflicts', () => {
    // twMerge keeps the last conflicting class.
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('px-2', false && 'px-4', 'text-sm')).toBe('px-2 text-sm');
  });
});

describe('errorMessages', () => {
  it('maps known codes to user messages', () => {
    expect(getUserMessage('QUOTA_EXCEEDED')).toMatch(/storage/i);
    expect(getUserMessage('CONNECTION_ERROR')).toMatch(/connection/i);
  });

  it('falls back to UNKNOWN for unknown codes', () => {
    expect(getUserMessage('NOT_A_REAL_CODE')).toBe(getUserMessage('UNKNOWN'));
  });

  it('formatError prefers .code when the error carries one', () => {
    const err = { code: 'QUOTA_EXCEEDED', message: 'boom' };
    expect(formatError(err)).toBe(getUserMessage('QUOTA_EXCEEDED'));
  });

  it('formatError string-matches quota and disconnect keywords', () => {
    expect(formatError(new Error('Quota exceeded: 5MB'))).toBe(getUserMessage('QUOTA_EXCEEDED'));
    expect(formatError(new Error('Port disconnected'))).toBe(getUserMessage('CONNECTION_ERROR'));
  });

  it('formatError falls back to UNKNOWN for arbitrary errors', () => {
    expect(formatError('something else')).toBe(getUserMessage('UNKNOWN'));
  });
});
