// Chrome API mock harness for characterization tests.
//
// Installs a fake `chrome` global with in-memory storage, alarm tracking,
// and event-listener registries. Tests drive the service worker by calling
// `fireMessage(...)` and `fireAlarm(...)` to invoke the listeners the SW
// registers at load time.
//
// Designed to be reset between tests via `installChromeMocks()`.

type Listener = (...args: any[]) => any;

export interface ChromeMocks {
  storage: Map<string, unknown>;
  alarms: Map<string, { scheduledTime: number; periodInMinutes?: number }>;
  onMessageListeners: Listener[];
  onAlarmListeners: Listener[];
  onCommandListeners: Listener[];
  onStorageChangedListeners: Listener[];
  dnrRules: Array<{ id: number; priority: number; action: any; condition: any }>;
  notifications: Array<{ id?: string; options: any }>;
  badge: { text: string; color: string };
  sentRuntimeMessages: Array<any>;
  offscreenCreated: boolean;
}

let current: ChromeMocks | null = null;

export function getMocks(): ChromeMocks {
  if (!current) throw new Error("Chrome mocks not installed — call installChromeMocks() first");
  return current;
}

/**
 * Invoke the SW's `chrome.runtime.onMessage` listener and await the response.
 * The SW signals async by returning `true` and calling `sendResponse` later.
 */
export function fireMessage<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const mocks = getMocks();
  const message = { action, ...payload };
  return new Promise((resolve, reject) => {
    let settled = false;
    const sendResponse = (response: unknown) => {
      if (settled) return;
      settled = true;
      resolve(response as T);
    };
    for (const listener of mocks.onMessageListeners) {
      let returned: unknown;
      try {
        returned = listener(message, { id: "test-sender" }, sendResponse);
      } catch (err) {
        reject(err);
        return;
      }
      // If the listener returned `true`, it will respond asynchronously.
      // If it returned a value synchronously (not used here), resolve immediately.
      if (returned !== true && !settled) {
        // No async response expected; keep waiting in case another listener handles it.
      }
    }
    // Safety net: if no listener responded within a tick, reject.
    queueMicrotask(() => {
      if (!settled) {
        // Allow slightly more time for async handlers.
        setTimeout(() => {
          if (!settled) reject(new Error(`No response for action "${action}"`));
        }, 100);
      }
    });
  });
}

export async function fireAlarm(name: string): Promise<void> {
  const mocks = getMocks();
  const alarm = { name, scheduledTime: Date.now() };
  for (const listener of mocks.onAlarmListeners) {
    await listener(alarm);
  }
}

export async function fireCommand(command: string): Promise<void> {
  const mocks = getMocks();
  for (const listener of mocks.onCommandListeners) {
    await listener(command);
  }
}

/**
 * Install the mock `chrome` global. Call in `beforeEach` to reset state.
 */
export function installChromeMocks(): ChromeMocks {
  const mocks: ChromeMocks = {
    storage: new Map(),
    alarms: new Map(),
    onMessageListeners: [],
    onAlarmListeners: [],
    onCommandListeners: [],
    onStorageChangedListeners: [],
    dnrRules: [],
    notifications: [],
    badge: { text: "", color: "" },
    sentRuntimeMessages: [],
    offscreenCreated: false,
  };
  current = mocks;

  const chromeGlobal = {
    runtime: {
      onMessage: {
        addListener: (fn: Listener) => mocks.onMessageListeners.push(fn),
        removeListener: (fn: Listener) => {
          mocks.onMessageListeners = mocks.onMessageListeners.filter((l) => l !== fn);
        },
      },
      // The SW sends internal messages to the offscreen document via
      // `chrome.runtime.sendMessage`. Tests don't consume these; just record them.
      sendMessage: async (msg: unknown) => {
        mocks.sentRuntimeMessages.push(msg);
        return undefined;
      },
      getURL: (path: string) => `chrome-extension://test/${path.replace(/^\//, "")}`,
      getContexts: async () => (mocks.offscreenCreated ? [{ contextType: "OFFSCREEN_DOCUMENT" }] : []),
      lastError: undefined as chrome.runtime.LastError | undefined,
    },

    storage: {
      local: {
        get: async (keys: string | string[] | Record<string, unknown> | null | undefined) => {
          if (keys === null || keys === undefined) {
            return Object.fromEntries(mocks.storage);
          }
          const keyList = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
          const result: Record<string, unknown> = {};
          for (const k of keyList) {
            if (mocks.storage.has(k)) result[k] = mocks.storage.get(k);
          }
          return result;
        },
        set: async (items: Record<string, unknown>) => {
          const changes: Record<string, { oldValue?: unknown; newValue: unknown }> = {};
          for (const [k, v] of Object.entries(items)) {
            const oldValue = mocks.storage.get(k);
            mocks.storage.set(k, v);
            changes[k] = { oldValue, newValue: v };
          }
          for (const listener of mocks.onStorageChangedListeners) {
            listener(changes, "local");
          }
        },
        remove: async (keys: string | string[]) => {
          const list = typeof keys === "string" ? [keys] : keys;
          const changes: Record<string, { oldValue: unknown; newValue?: unknown }> = {};
          for (const k of list) {
            if (mocks.storage.has(k)) {
              changes[k] = { oldValue: mocks.storage.get(k) };
              mocks.storage.delete(k);
            }
          }
          if (Object.keys(changes).length > 0) {
            for (const listener of mocks.onStorageChangedListeners) {
              listener(changes, "local");
            }
          }
        },
        clear: async () => {
          mocks.storage.clear();
        },
      },
      onChanged: {
        addListener: (fn: Listener) => mocks.onStorageChangedListeners.push(fn),
        removeListener: (fn: Listener) => {
          mocks.onStorageChangedListeners = mocks.onStorageChangedListeners.filter((l) => l !== fn);
        },
      },
    },

    alarms: {
      create: async (name: string, info: { delayInMinutes?: number; periodInMinutes?: number }) => {
        const delayMs = (info.delayInMinutes ?? 0) * 60000;
        mocks.alarms.set(name, {
          scheduledTime: Date.now() + delayMs,
          periodInMinutes: info.periodInMinutes,
        });
      },
      clear: async (name: string) => {
        const existed = mocks.alarms.delete(name);
        return existed;
      },
      clearAll: async () => {
        mocks.alarms.clear();
        return true;
      },
      getAll: async () => {
        return Array.from(mocks.alarms.entries()).map(([name, info]) => ({
          name,
          scheduledTime: info.scheduledTime,
          periodInMinutes: info.periodInMinutes,
        }));
      },
      get: async (name: string) => {
        const info = mocks.alarms.get(name);
        if (!info) return undefined;
        return { name, scheduledTime: info.scheduledTime, periodInMinutes: info.periodInMinutes };
      },
      onAlarm: {
        addListener: (fn: Listener) => mocks.onAlarmListeners.push(fn),
        removeListener: (fn: Listener) => {
          mocks.onAlarmListeners = mocks.onAlarmListeners.filter((l) => l !== fn);
        },
      },
    },

    commands: {
      onCommand: {
        addListener: (fn: Listener) => mocks.onCommandListeners.push(fn),
        removeListener: (fn: Listener) => {
          mocks.onCommandListeners = mocks.onCommandListeners.filter((l) => l !== fn);
        },
      },
    },

    notifications: {
      create: (options: any) => {
        mocks.notifications.push({ options });
      },
    },

    action: {
      setBadgeText: async (details: { text: string }) => {
        mocks.badge.text = details.text;
      },
      setBadgeBackgroundColor: async (details: { color: string }) => {
        mocks.badge.color = details.color;
      },
    },

    declarativeNetRequest: {
      getDynamicRules: async () => [...mocks.dnrRules],
      updateDynamicRules: async ({
        removeRuleIds = [],
        addRules = [],
      }: {
        removeRuleIds?: number[];
        addRules?: any[];
      }) => {
        mocks.dnrRules = mocks.dnrRules.filter((r) => !removeRuleIds.includes(r.id));
        mocks.dnrRules.push(...addRules);
      },
    },

    offscreen: {
      createDocument: async (_opts: unknown) => {
        mocks.offscreenCreated = true;
      },
    },
  };

  (globalThis as any).chrome = chromeGlobal;
  // The SW uses `new Audio(...)` only on the Firefox path (chrome.offscreen branch is taken here).
  // Provide a no-op URL global if needed.
  if (typeof (globalThis as any).crypto === "undefined") {
    (globalThis as any).crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
  }
  return mocks;
}

export function uninstallChromeMocks() {
  current = null;
  delete (globalThis as any).chrome;
}
