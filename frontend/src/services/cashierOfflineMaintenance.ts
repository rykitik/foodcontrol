import {
  CASHIER_PARTITION_RETENTION_MS,
  CASHIER_SYNC_STATE_RETENTION_MS,
} from '@/config/runtime'
import {
  CASHIER_OFFLINE_STORES,
  idbDeleteMany,
  idbGetAllByIndex,
  isCashierOfflineDbAvailable,
} from '@/services/cashierOfflineDb'
import {
  clearCashierStoragePartition,
  getActiveCashierStoragePartition,
  loadOfflineQueueForActivePartitionSync,
  persistOfflineQueueForActivePartition,
} from '@/services/cashierOfflineStorage'
import type {
  CashierStoragePartition,
  CashierSyncStateRecord,
  CashierSyncStateStatus,
  CashierTerminalMetaRecord,
} from '@/types/cashierOfflineStorage'

const STORAGE_ROLE = 'cashier' as const
const RESOLVED_QUEUE_SYNC_STATUSES = new Set<CashierSyncStateStatus>(['acked', 'rejected', 'needs_review'])
const EXPIRING_SYNC_STATUSES = new Set<CashierSyncStateStatus>(['acked', 'rejected'])

export interface CashierOfflineMaintenanceReport {
  resolved_queue_items_removed: number
  expired_sync_states_deleted: number
  stale_partitions_deleted: number
}

function partitionKey(partition: CashierStoragePartition): string {
  return `${partition.terminal_id}:${partition.user_id}`
}

function samePartition(left: CashierStoragePartition | null | undefined, right: CashierStoragePartition | null | undefined): boolean {
  return Boolean(
    left &&
      right &&
      left.role === STORAGE_ROLE &&
      right.role === STORAGE_ROLE &&
      left.terminal_id === right.terminal_id &&
      left.user_id === right.user_id,
  )
}

function toMs(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function buildPartition(record: Pick<CashierTerminalMetaRecord, 'terminal_id' | 'user_id'>): CashierStoragePartition {
  return {
    terminal_id: record.terminal_id,
    user_id: record.user_id,
    role: STORAGE_ROLE,
  }
}

async function readSyncStateRecords(partition: CashierStoragePartition): Promise<CashierSyncStateRecord[]> {
  if (!isCashierOfflineDbAvailable()) {
    return []
  }

  return idbGetAllByIndex<CashierSyncStateRecord>(
    CASHIER_OFFLINE_STORES.sync_state,
    'partition_key',
    partitionKey(partition),
  )
}

export async function cleanupResolvedQueueForActiveCashierPartition(): Promise<number> {
  const partition = getActiveCashierStoragePartition()
  if (!partition) {
    return 0
  }

  const syncStates = await readSyncStateRecords(partition)
  const resolvedRequestIds = new Set(
    syncStates.filter((state) => RESOLVED_QUEUE_SYNC_STATUSES.has(state.status)).map((state) => state.request_id),
  )
  if (!resolvedRequestIds.size) {
    return 0
  }

  const queue = loadOfflineQueueForActivePartitionSync()
  const nextQueue = queue.filter((item) => !resolvedRequestIds.has(item.request_id))
  const removedCount = queue.length - nextQueue.length
  if (removedCount <= 0) {
    return 0
  }

  await persistOfflineQueueForActivePartition(nextQueue)
  return removedCount
}

export async function cleanupExpiredSyncStatesForActiveCashierPartition(): Promise<number> {
  const partition = getActiveCashierStoragePartition()
  if (!partition || !isCashierOfflineDbAvailable()) {
    return 0
  }

  const thresholdMs = Date.now() - CASHIER_SYNC_STATE_RETENTION_MS
  const syncStates = await readSyncStateRecords(partition)
  const expiredKeys = syncStates
    .filter((state) => EXPIRING_SYNC_STATUSES.has(state.status))
    .filter((state) => {
      const updatedAt = toMs(state.updated_at)
      return updatedAt !== null && updatedAt <= thresholdMs
    })
    .map((state) => state.sync_state_id)

  if (!expiredKeys.length) {
    return 0
  }

  await idbDeleteMany(CASHIER_OFFLINE_STORES.sync_state, expiredKeys)
  return expiredKeys.length
}

export async function cleanupStaleCashierPartitionsForUser(userId: string): Promise<number> {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId || !isCashierOfflineDbAvailable()) {
    return 0
  }

  const activePartition = getActiveCashierStoragePartition()
  const partitionRecords = await idbGetAllByIndex<CashierTerminalMetaRecord>(
    CASHIER_OFFLINE_STORES.terminal_meta,
    'user_id',
    normalizedUserId,
  )

  let deletedCount = 0
  const thresholdMs = Date.now() - CASHIER_PARTITION_RETENTION_MS
  for (const record of partitionRecords) {
    if (record.role !== STORAGE_ROLE || record.user_id !== normalizedUserId) {
      continue
    }

    const partition = buildPartition(record)
    if (samePartition(partition, activePartition)) {
      continue
    }

    const updatedAt = toMs(record.last_seen_at || record.provisioned_at)
    if (updatedAt === null || updatedAt > thresholdMs) {
      continue
    }

    await clearCashierStoragePartition(partition)
    deletedCount += 1
  }

  return deletedCount
}

export async function runCashierOfflineMaintenance(options: {
  userId?: string | null
} = {}): Promise<CashierOfflineMaintenanceReport> {
  const resolved_queue_items_removed = await cleanupResolvedQueueForActiveCashierPartition()
  const expired_sync_states_deleted = await cleanupExpiredSyncStatesForActiveCashierPartition()
  const stale_partitions_deleted = options.userId
    ? await cleanupStaleCashierPartitionsForUser(options.userId)
    : 0

  return {
    resolved_queue_items_removed,
    expired_sync_states_deleted,
    stale_partitions_deleted,
  }
}
