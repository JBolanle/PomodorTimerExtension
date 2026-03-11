export async function getStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? fallback;
}

export async function setStorage<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export function onStorageChanged(
  key: string,
  callback: (newValue: unknown) => void
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[key]) {
      callback(changes[key].newValue);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
