const ERROR_MESSAGES: Record<string, string> = {
  QUOTA_EXCEEDED: 'Storage is full. Try clearing old session history.',
  STORAGE_ERROR: 'Unable to save data. Please try again.',
  ALARM_FAILED: 'Timer alarm failed to set. Please restart the extension.',
  INVALID_PHASE: 'Invalid timer phase selected.',
  DNR_FAILED: 'Unable to enable site blocking. Check extension permissions.',
  DOMAIN_INVALID: 'Invalid domain format.',
  CONNECTION_ERROR: 'Lost connection to extension. Please reload.',
  NO_RESPONSE: 'Extension not responding. Please reload.',
  OPERATION_FAILED: 'Operation failed. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function getUserMessage(code: string): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
}

export function formatError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: string }).code === 'string') {
    return getUserMessage((error as { code: string }).code);
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (message.includes('quota')) return ERROR_MESSAGES.QUOTA_EXCEEDED;
  if (message.includes('disconnected')) return ERROR_MESSAGES.CONNECTION_ERROR;

  return ERROR_MESSAGES.UNKNOWN;
}
