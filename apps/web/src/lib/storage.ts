export const STORAGE_KEYS = { theme: "openspaces.theme" } as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readStorage(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}
