export async function readProgress(key: string) {
  const customStorage = (window as Window & {
    storage?: { get: (storageKey: string) => Promise<{ value?: string | null } | null> }
  }).storage

  if (customStorage) {
    const result = await customStorage.get(key)
    return result?.value ?? null
  }

  return window.localStorage.getItem(key)
}

export async function writeProgress(key: string, value: string) {
  const customStorage = (window as Window & {
    storage?: { set: (storageKey: string, storageValue: string) => Promise<void> }
  }).storage

  if (customStorage) {
    await customStorage.set(key, value)
    return
  }

  window.localStorage.setItem(key, value)
}
