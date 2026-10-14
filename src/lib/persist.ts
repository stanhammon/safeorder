import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'

/** How long cached household data stays usable offline. */
export const CACHE_MAX_AGE_MS = 30 * 24 * 3_600_000

/** TanStack Query cache saved to IndexedDB so data survives restarts offline (SPEC §6.4). */
export const persister = createAsyncStoragePersister({
  key: 'safeorder-cache',
  storage: {
    getItem: (key) => get<string>(key).then((v) => v ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  throttleTime: 1000,
})
