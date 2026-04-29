import {
  getActiveCashierStoragePartition,
  loadOfflineQueueForActivePartitionSync,
  saveOfflineQueueForActivePartition,
} from '@/services/cashierOfflineStorage'
import type { CashierQueuePayload } from '@/types/cashierOfflineStorage'

export interface PendingCashierSelection extends CashierQueuePayload {}

export interface CashierEventEntry {
  id: string
  message: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  created_at: string
}

const EVENT_LOG_KEY = 'foodcontrol-cashier-events'

function readStorage<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') {
    return fallback
  }

  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(key, JSON.stringify(value))
}

function hasActiveCashierContext(): boolean {
  return Boolean(getActiveCashierStoragePartition())
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadCashierQueue(): PendingCashierSelection[] {
  return loadOfflineQueueForActivePartitionSync()
}

export function saveCashierQueue(queue: PendingCashierSelection[]) {
  saveOfflineQueueForActivePartition(queue)
}

export function loadCashierEvents(limit?: number): CashierEventEntry[] {
  if (!hasActiveCashierContext()) {
    return []
  }

  const events = readStorage<CashierEventEntry[]>(EVENT_LOG_KEY, [])
  return typeof limit === 'number' ? events.slice(0, limit) : events
}

export function pushCashierEvent(
  message: string,
  tone: CashierEventEntry['tone'] = 'info',
): CashierEventEntry[] {
  if (!hasActiveCashierContext()) {
    return []
  }

  const nextEntry: CashierEventEntry = {
    id: createId('cashier-event'),
    message,
    tone,
    created_at: new Date().toISOString(),
  }

  const nextEvents = [nextEntry, ...loadCashierEvents()].slice(0, 40)
  writeStorage(EVENT_LOG_KEY, nextEvents)
  return nextEvents
}

export function clearCashierEventLogStorage(): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.removeItem(EVENT_LOG_KEY)
}
