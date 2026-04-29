export const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api'
export const AUTH_STORAGE_KEY = 'foodcontrol-auth'

// Backend-first by default. Mock stays an explicit secondary fallback for dev/demo only.
export const USE_MOCK_API_FALLBACK = import.meta.env.VITE_USE_MOCK_API === 'true'

// Backward-compatible alias for existing imports. Prefer USE_MOCK_API_FALLBACK in new code.
export const ENABLE_MOCK_API = USE_MOCK_API_FALLBACK

function readPositiveNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const CASHIER_SNAPSHOT_FRESH_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_SNAPSHOT_FRESH_MS,
  1000 * 60 * 60 * 6,
)

export const CASHIER_SNAPSHOT_STALE_MAX_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_SNAPSHOT_STALE_MAX_MS,
  1000 * 60 * 60 * 48,
)

export const CASHIER_OFFLINE_QUEUE_MAX_ITEMS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_OFFLINE_QUEUE_MAX_ITEMS,
  500,
)

export const CASHIER_STARTUP_CACHE_TTL_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_STARTUP_CACHE_TTL_MS,
  1000 * 15,
)

export const CASHIER_STARTUP_ONLINE_PROBE_TIMEOUT_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_STARTUP_ONLINE_PROBE_TIMEOUT_MS,
  4500,
)

export const CASHIER_RECONNECT_PROBE_INTERVAL_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_RECONNECT_PROBE_INTERVAL_MS,
  5000,
)

export const CASHIER_SYNC_STATE_RETENTION_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_SYNC_STATE_RETENTION_MS,
  1000 * 60 * 60 * 24 * 7,
)

export const CASHIER_PARTITION_RETENTION_MS = readPositiveNumberEnv(
  import.meta.env.VITE_CASHIER_PARTITION_RETENTION_MS,
  1000 * 60 * 60 * 24 * 14,
)
