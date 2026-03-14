# Error Handling Implementation Guide

## Current State

The service worker already has solid error handling:
- ✅ Try/catch around storage operations
- ✅ `.catch()` on alarm and DNR operations  
- ✅ Error responses with `{ success: false, error: message }`
- ✅ Console logging with `[Pomodoro]` prefix

**What's missing:**
- ❌ User-facing error feedback (toasts/alerts)
- ❌ Loading states in UI
- ❌ Retry mechanisms for transient failures
- ❌ Error boundaries in React
- ❌ Graceful degradation when features fail

---

## 1. Toast Notification System (Popup/Options)

### Toast Component

```jsx
// components/ui/toast.jsx
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', message, duration = 4000 }) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (message) => addToast({ type: 'success', message }),
    error: (message) => addToast({ type: 'error', message, duration: 6000 }),
    info: (message) => addToast({ type: 'info', message }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ type, message, onDismiss }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg shadow-lg border",
        "bg-background animate-in slide-in-from-right-5",
        type === 'error' && "border-red-200 bg-red-50 dark:bg-red-950/20",
        type === 'success' && "border-green-200 bg-green-50 dark:bg-green-950/20",
        type === 'info' && "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
      )}
    >
      {icons[type]}
      <p className="flex-1 text-sm">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

### Usage in Components

```jsx
function TimerControls() {
  const toast = useToast();

  const handleStart = async () => {
    const response = await chrome.runtime.sendMessage({ action: 'start' });
    
    if (!response?.success) {
      toast.error(response?.error || 'Failed to start timer');
      return;
    }
    
    // Update UI...
  };

  const handleExport = async () => {
    try {
      const { sessions } = await chrome.storage.local.get('sessions');
      // ... export logic
      toast.success('Session history exported');
    } catch (err) {
      toast.error('Failed to export history');
    }
  };
}
```

---

## 2. Loading States

### useAsyncAction Hook

```jsx
// hooks/useAsyncAction.js
import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';

export function useAsyncAction(action, options = {}) {
  const { 
    onSuccess, 
    onError, 
    successMessage, 
    errorMessage,
    showSuccessToast = false,
    showErrorToast = true,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);

    try {
      const result = await action(...args);
      
      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }
      
      onSuccess?.(result);
      return result;
    } catch (err) {
      const message = errorMessage || err.message || 'Something went wrong';
      setError(message);
      
      if (showErrorToast) {
        toast.error(message);
      }
      
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [action, onSuccess, onError, successMessage, errorMessage, showSuccessToast, showErrorToast, toast]);

  return { execute, loading, error, clearError: () => setError(null) };
}
```

### Usage

```jsx
function SettingsForm() {
  const { execute: saveSettings, loading, error } = useAsyncAction(
    async (settings) => {
      const response = await chrome.runtime.sendMessage({ 
        action: 'updateSettings', 
        settings 
      });
      if (!response?.success) throw new Error(response?.error);
      return response;
    },
    {
      successMessage: 'Settings saved',
      showSuccessToast: true,
    }
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); saveSettings(formData); }}>
      {/* form fields */}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
      
      {error && (
        <p className="text-red-500 text-sm mt-2" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
```

---

## 3. Error Boundary

```jsx
// components/ErrorBoundary.jsx
import { Component } from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Pomodoro] React error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <div className="text-red-500 mb-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
          </div>
          <h2 className="font-semibold mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.props.fallbackMessage || 'The extension encountered an error.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Usage in App

```jsx
// popup/App.jsx
function App() {
  return (
    <ErrorBoundary fallbackMessage="Unable to load timer">
      <ToastProvider>
        <TimerApp />
      </ToastProvider>
    </ErrorBoundary>
  );
}
```

---

## 4. Message Passing Helper

Wrap `chrome.runtime.sendMessage` with consistent error handling:

```jsx
// lib/messaging.js

export class ExtensionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
  }
}

export async function sendMessage(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      // Check for connection errors
      if (chrome.runtime.lastError) {
        reject(new ExtensionError(
          'Unable to connect to extension',
          'CONNECTION_ERROR'
        ));
        return;
      }

      // Check for null/undefined response
      if (!response) {
        reject(new ExtensionError(
          'No response from extension',
          'NO_RESPONSE'
        ));
        return;
      }

      // Check for error response
      if (response.success === false) {
        reject(new ExtensionError(
          response.error || 'Operation failed',
          response.code || 'OPERATION_FAILED'
        ));
        return;
      }

      resolve(response);
    });
  });
}

// Convenience methods
export const api = {
  getState: () => sendMessage('getState'),
  start: (phase, minutes) => sendMessage('start', { phase, minutes }),
  pause: () => sendMessage('pause'),
  resume: () => sendMessage('resume'),
  reset: () => sendMessage('reset'),
  skip: () => sendMessage('skip'),
  updateSettings: (settings) => sendMessage('updateSettings', { settings }),
  allowOnce: (domain, minutes) => sendMessage('allowOnce', { domain, minutes }),
};
```

### Usage

```jsx
import { api, ExtensionError } from '@/lib/messaging';

async function handleStart() {
  try {
    await api.start('work', 25);
    // Success...
  } catch (err) {
    if (err instanceof ExtensionError) {
      if (err.code === 'CONNECTION_ERROR') {
        toast.error('Extension disconnected. Please reload.');
      } else {
        toast.error(err.message);
      }
    } else {
      toast.error('Unexpected error');
    }
  }
}
```

---

## 5. Retry Logic for Storage Operations

Add to service worker for transient failures:

```javascript
// background/utils.js

async function withRetry(fn, options = {}) {
  const { maxAttempts = 3, delay = 100, backoff = 2 } = options;
  
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[Pomodoro] Attempt ${attempt}/${maxAttempts} failed:`, err.message);
      
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay * Math.pow(backoff, attempt - 1)));
      }
    }
  }
  
  throw lastError;
}

// Usage in service worker
async function persistState() {
  const data = { /* ... */ };
  
  await withRetry(
    () => chrome.storage.local.set(data),
    { maxAttempts: 3, delay: 50 }
  );
}
```

---

## 6. Graceful Degradation

### Feature Detection Wrapper

```javascript
// background/features.js

export const features = {
  notifications: (() => {
    try {
      return typeof chrome.notifications?.create === 'function';
    } catch {
      return false;
    }
  })(),
  
  offscreen: (() => {
    try {
      return typeof chrome.offscreen?.createDocument === 'function';
    } catch {
      return false;
    }
  })(),
  
  declarativeNetRequest: (() => {
    try {
      return typeof chrome.declarativeNetRequest?.updateDynamicRules === 'function';
    } catch {
      return false;
    }
  })(),
};

export function requireFeature(name, fallback) {
  if (!features[name]) {
    console.warn(`[Pomodoro] Feature "${name}" not available, using fallback`);
    return fallback;
  }
  return null;
}
```

### Usage

```javascript
async function sendNotification(message) {
  if (!features.notifications) {
    console.log('[Pomodoro] Notification (no API):', message);
    return; // Silently skip
  }
  
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Pomodoro Timer',
      message,
    });
  } catch (err) {
    // Notification permission might be denied
    console.warn('[Pomodoro] Notification failed:', err.message);
  }
}
```

---

## 7. Connection State Handling

Handle service worker disconnection in popup:

```jsx
// hooks/useConnectionStatus.js
import { useState, useEffect } from 'react';

export function useConnectionStatus() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const checkConnection = () => {
      chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          setConnected(false);
        } else {
          setConnected(true);
        }
      });
    };

    // Check immediately and periodically
    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  return connected;
}
```

### Disconnected Banner

```jsx
function App() {
  const connected = useConnectionStatus();

  return (
    <div>
      {!connected && (
        <div 
          role="alert"
          className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800"
        >
          Connection lost. <button onClick={() => window.location.reload()} className="underline">Reload</button>
        </div>
      )}
      
      <TimerApp />
    </div>
  );
}
```

Add handler in service worker:

```javascript
// In message handler
case 'ping':
  sendResponse({ success: true, timestamp: Date.now() });
  break;
```

---

## 8. Blocked Page Error Handling

Improve the blocked page to handle edge cases:

```javascript
// blocked/blocked.js additions

function handleCommunicationError() {
  const display = document.getElementById('timer-display');
  display.textContent = '--:--';
  
  const status = document.createElement('p');
  status.className = 'text-sm text-amber-600 mt-2';
  status.textContent = 'Unable to connect to extension';
  status.id = 'error-status';
  
  if (!document.getElementById('error-status')) {
    display.parentNode.appendChild(status);
  }
  
  // Retry connection
  setTimeout(updateTimer, 2000);
}

function updateTimer() {
  chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
    // Remove error status if present
    const errorStatus = document.getElementById('error-status');
    if (errorStatus) errorStatus.remove();
    
    if (chrome.runtime.lastError) {
      console.warn('[Pomodoro] Connection error:', chrome.runtime.lastError.message);
      handleCommunicationError();
      return;
    }

    if (!response) {
      handleCommunicationError();
      return;
    }

    // ... rest of timer logic
  });
}
```

---

## 9. User-Friendly Error Messages

Map technical errors to friendly messages:

```javascript
// lib/errorMessages.js

const ERROR_MESSAGES = {
  // Storage
  'QUOTA_EXCEEDED': 'Storage is full. Try clearing old session history.',
  'STORAGE_ERROR': 'Unable to save data. Please try again.',
  
  // Timer
  'ALARM_FAILED': 'Timer alarm failed to set. Please restart the extension.',
  'INVALID_PHASE': 'Invalid timer phase selected.',
  
  // Focus Mode
  'DNR_FAILED': 'Unable to enable site blocking. Check extension permissions.',
  'DOMAIN_INVALID': 'Invalid domain format.',
  
  // Connection
  'CONNECTION_ERROR': 'Lost connection to extension. Please reload.',
  'NO_RESPONSE': 'Extension not responding. Please reload.',
  
  // General
  'UNKNOWN': 'Something went wrong. Please try again.',
};

export function getUserMessage(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
}

export function formatError(error) {
  if (error instanceof ExtensionError) {
    return getUserMessage(error.code);
  }
  
  // Check for known error patterns
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('quota')) return ERROR_MESSAGES.QUOTA_EXCEEDED;
  if (message.includes('disconnected')) return ERROR_MESSAGES.CONNECTION_ERROR;
  
  return ERROR_MESSAGES.UNKNOWN;
}
```

---

## 10. Testing Checklist

### Error Scenarios to Test

- [ ] Start timer with storage full
- [ ] Pause/resume with service worker suspended
- [ ] Enable focus mode without `<all_urls>` permission
- [ ] Export history with no sessions
- [ ] Import invalid JSON file
- [ ] Notification permission denied
- [ ] Sound playback blocked (autoplay policy)
- [ ] Rapid button clicks (debounce handling)
- [ ] Extension update mid-session
- [ ] Browser restart recovery

### Verification Points

- [ ] User sees feedback for every action
- [ ] Errors don't crash the UI
- [ ] Retry available for recoverable errors
- [ ] Console logs include context for debugging
- [ ] No silent failures for critical operations

---

## Claude Code Prompt

```
Add error handling improvements to the Pomodoro extension.

Reference: ERROR_HANDLING_IMPLEMENTATION.md

Key changes:

1. Create Toast notification system (components/ui/toast.jsx):
   - ToastProvider context
   - useToast hook with success/error/info methods
   - Auto-dismiss with configurable duration
   - Accessible with role="alert"

2. Create useAsyncAction hook:
   - Wraps async operations with loading/error state
   - Integrates with toast for automatic notifications
   - Returns { execute, loading, error }

3. Create ErrorBoundary component:
   - Catches React rendering errors
   - Shows friendly error message with retry button
   - Logs errors to console

4. Create messaging utility (lib/messaging.js):
   - Wrap chrome.runtime.sendMessage with promise API
   - ExtensionError class with error codes
   - api object with typed methods

5. Add connection status hook and banner:
   - useConnectionStatus hook with periodic ping
   - Warning banner when disconnected
   - Add 'ping' handler to service worker

6. Update blocked page error handling:
   - Show "--:--" on connection error
   - Display error message with auto-retry
   - Remove error status when connection restored

7. Create error message mapping:
   - User-friendly messages for error codes
   - formatError helper for unknown errors

Wrap main App components:
- <ErrorBoundary><ToastProvider><App /></ToastProvider></ErrorBoundary>

Update existing handlers to use toast.error() on failures.
```
