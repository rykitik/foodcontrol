import { syncCashierOfflineSelections } from '@/services/api'
import { recordCashierIssuedMealsForActivePartition } from '@/services/cashierOfflineIssuedLedger'
import {
  CASHIER_OFFLINE_STORES,
  idbDelete,
  idbGet,
  idbGetAllByIndex,
  idbPut,
  isCashierOfflineDbAvailable,
} from '@/services/cashierOfflineDb'
import {
  getActiveCashierStoragePartition,
  loadOfflineQueueForActivePartitionSync,
  persistOfflineQueueForActivePartition,
} from '@/services/cashierOfflineStorage'
import { sanitizeCashierSyncResultMessage } from '@/services/cashierRequestErrors'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import type { CashierOfflineSyncResultItem, CashierQueuePayload } from '@/types'
import type { CashierStoragePartition, CashierSyncStateRecord, CashierSyncStateStatus } from '@/types/cashierOfflineStorage'

const STORAGE_ROLE = 'cashier' as const
const DEFAULT_BATCH_SIZE = 25
const BACKOFF_BASE_MS = 5_000
const BACKOFF_MAX_MS = 5 * 60_000
const TERMINAL_SYNC_STATUSES = new Set<CashierSyncStateStatus>(['acked', 'rejected', 'needs_review'])

export interface CashierOfflineSyncRunResult {
  processed_count: number
  pending_count: number
  acked_count: number
  rejected_count: number
  needs_review_count: number
  next_retry_in_ms: number | null
  halted_reason?: 'network' | 'auth_failed' | 'unexpected'
}

export interface CashierNeedsReviewItem {
  request_id: string
  payload: CashierQueuePayload
  reason: string | null
  updated_at: string
  server_status: number | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function partitionKey(partition: CashierStoragePartition): string {
  return `${partition.terminal_id}:${partition.user_id}`
}

function syncStateId(partition: CashierStoragePartition, requestId: string): string {
  return `${partitionKey(partition)}:${requestId}`
}

function isCashierPartition(partition: CashierStoragePartition | null): partition is CashierStoragePartition {
  return Boolean(partition && partition.role === STORAGE_ROLE)
}

function toMs(timestamp: string | null | undefined): number | null {
  if (!timestamp) {
    return null
  }

  const parsed = Date.parse(timestamp)
  return Number.isNaN(parsed) ? null : parsed
}

function backoffDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, attempt)
  const delay = BACKOFF_BASE_MS * 2 ** (safeAttempt - 1)
  return Math.min(delay, BACKOFF_MAX_MS)
}

function messageFromSyncResult(result: CashierOfflineSyncResultItem | undefined): string | null {
  if (!result) {
    return 'Требуется ручная проверка'
  }

  return sanitizeCashierSyncResultMessage(result.message) ?? 'Требуется ручная проверка'
}

function toSyncRequestPayload(item: CashierQueuePayload) {
  return {
    request_id: item.request_id,
    code: item.code,
    selected_meals: item.selected_meals,
    issue_date: item.issue_date,
    notes: item.notes,
  }
}

function recordAckedQueueItem(queueItem: CashierQueuePayload, result: CashierOfflineSyncResultItem): void {
  const issuedMeals =
    result.data?.issued_meals && result.data.issued_meals.length
      ? result.data.issued_meals
      : []

  if (!issuedMeals.length) {
    return
  }

  recordCashierIssuedMealsForActivePartition({
    issue_date: queueItem.issue_date || nowIso().slice(0, 10),
    meal_types: issuedMeals,
    source: 'offline_sync_acked',
    student_id: queueItem.student_id,
    ticket_id: queueItem.ticket_id,
    request_id: queueItem.request_id,
  })
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

async function readSyncStateByRequestId(
  partition: CashierStoragePartition,
  requestId: string,
): Promise<CashierSyncStateRecord | null> {
  if (!isCashierOfflineDbAvailable()) {
    return null
  }

  return (
    (await idbGet<CashierSyncStateRecord>(
      CASHIER_OFFLINE_STORES.sync_state,
      syncStateId(partition, requestId),
    )) ?? null
  )
}

async function upsertSyncState(record: CashierSyncStateRecord): Promise<void> {
  if (!isCashierOfflineDbAvailable()) {
    return
  }

  await idbPut(CASHIER_OFFLINE_STORES.sync_state, record)
}

async function persistSyncStates(stateMap: Map<string, CashierSyncStateRecord>): Promise<void> {
  if (!isCashierOfflineDbAvailable()) {
    return
  }

  await Promise.all([...stateMap.values()].map((record) => upsertSyncState(record)))
}

function nextRetryInMs(queue: CashierQueuePayload[], stateMap: Map<string, CashierSyncStateRecord>): number | null {
  const now = Date.now()
  let minDelay: number | null = null

  queue.forEach((item) => {
    const state = stateMap.get(item.request_id)
    const retryAt = toMs(state?.next_retry_at)
    if (retryAt === null || retryAt <= now) {
      minDelay = minDelay === null ? 0 : Math.min(minDelay, 0)
      return
    }

    const delay = retryAt - now
    minDelay = minDelay === null ? delay : Math.min(minDelay, delay)
  })

  return minDelay
}

async function persistQueueAndStates(
  queue: CashierQueuePayload[],
  stateMap: Map<string, CashierSyncStateRecord>,
  options?: { statesFirst?: boolean },
): Promise<void> {
  if (options?.statesFirst) {
    await persistSyncStates(stateMap)
  }

  await persistOfflineQueueForActivePartition(queue)

  if (!options?.statesFirst) {
    await persistSyncStates(stateMap)
  }
}

export async function enqueueCashierOfflineSelection(item: CashierQueuePayload): Promise<void> {
  const partition = getActiveCashierStoragePartition()
  if (!isCashierPartition(partition)) {
    return
  }

  const existingQueue = loadOfflineQueueForActivePartitionSync()
  const nextQueue = [item, ...existingQueue.filter((entry) => entry.request_id !== item.request_id)]
  await persistOfflineQueueForActivePartition(nextQueue)

  const existingState = await readSyncStateByRequestId(partition, item.request_id)
  await upsertSyncState({
    sync_state_id: syncStateId(partition, item.request_id),
    partition_key: partitionKey(partition),
    terminal_id: partition.terminal_id,
    user_id: partition.user_id,
    role: STORAGE_ROLE,
    request_id: item.request_id,
    status: 'pending',
    payload: item,
    attempt_count: existingState?.attempt_count ?? 0,
    last_attempt_at: existingState?.last_attempt_at ?? null,
    next_retry_at: null,
    last_error: null,
    server_status: null,
    review_reason: null,
    updated_at: nowIso(),
  })
}

export async function runCashierOfflineQueueSync(params: {
  token: string | null
  force?: boolean
  batchSize?: number
}): Promise<CashierOfflineSyncRunResult> {
  const partition = getActiveCashierStoragePartition()
  const queue = loadOfflineQueueForActivePartitionSync()

  if (!isCashierPartition(partition) || !queue.length) {
    return {
      processed_count: 0,
      pending_count: queue.length,
      acked_count: 0,
      rejected_count: 0,
      needs_review_count: 0,
      next_retry_in_ms: null,
    }
  }

  if (!params.token) {
    return {
      processed_count: 0,
      pending_count: queue.length,
      acked_count: 0,
      rejected_count: 0,
      needs_review_count: 0,
      next_retry_in_ms: null,
      halted_reason: 'auth_failed',
    }
  }

  const stateRecords = await readSyncStateRecords(partition)
  const stateMap = new Map<string, CashierSyncStateRecord>()
  stateRecords.forEach((state) => {
    stateMap.set(state.request_id, state)
  })

  const now = Date.now()
  const eligibleQueueItems = queue.filter((item) => {
    const state = stateMap.get(item.request_id)
    if (state && TERMINAL_SYNC_STATUSES.has(state.status)) {
      return false
    }

    if (params.force) {
      return true
    }

    const retryAt = toMs(state?.next_retry_at)
    return retryAt === null || retryAt <= now
  })

  if (!eligibleQueueItems.length) {
    return {
      processed_count: 0,
      pending_count: queue.length,
      acked_count: 0,
      rejected_count: 0,
      needs_review_count: 0,
      next_retry_in_ms: nextRetryInMs(queue, stateMap),
    }
  }

  const batchSize = Math.max(1, params.batchSize ?? DEFAULT_BATCH_SIZE)
  const processedBatch = eligibleQueueItems.slice(0, batchSize)

  const markPendingFailure = (item: CashierQueuePayload, reason: string | null): void => {
    const existingState = stateMap.get(item.request_id)
    const attemptCount = (existingState?.attempt_count ?? 0) + 1
    const delay = backoffDelayMs(attemptCount)
    const retryAt = new Date(Date.now() + delay).toISOString()

    stateMap.set(item.request_id, {
      sync_state_id: syncStateId(partition, item.request_id),
      partition_key: partitionKey(partition),
      terminal_id: partition.terminal_id,
      user_id: partition.user_id,
      role: STORAGE_ROLE,
      request_id: item.request_id,
      status: 'pending',
      payload: item,
      attempt_count: attemptCount,
      last_attempt_at: nowIso(),
      next_retry_at: retryAt,
      last_error: reason,
      server_status: null,
      review_reason: null,
      updated_at: nowIso(),
    })
  }

  try {
    const syncResult = await syncCashierOfflineSelections(
      processedBatch.map((item) => ({
        client_item_id: item.request_id,
        request: toSyncRequestPayload(item),
      })),
      params.token,
    )

    const resultMap = new Map<string, CashierOfflineSyncResultItem>()
    syncResult.results.forEach((item) => {
      resultMap.set(item.client_item_id || item.request_id, item)
      if (item.request_id) {
        resultMap.set(item.request_id, item)
      }
    })

    let ackedCount = 0
    let rejectedCount = 0
    let needsReviewCount = 0

    const remainingQueue = [...queue]
    processedBatch.forEach((queueItem) => {
      const result = resultMap.get(queueItem.request_id)
      if (!result) {
        markPendingFailure(queueItem, 'missing sync result')
        return
      }

      if (result.status === 'acked') {
        ackedCount += 1
        stateMap.set(queueItem.request_id, {
          sync_state_id: syncStateId(partition, queueItem.request_id),
          partition_key: partitionKey(partition),
          terminal_id: partition.terminal_id,
          user_id: partition.user_id,
          role: STORAGE_ROLE,
          request_id: queueItem.request_id,
          status: 'acked',
          payload: queueItem,
          attempt_count: stateMap.get(queueItem.request_id)?.attempt_count ?? 0,
          last_attempt_at: nowIso(),
          next_retry_at: null,
          last_error: null,
          server_status: result.http_status,
          review_reason: null,
          updated_at: nowIso(),
        })
        recordAckedQueueItem(queueItem, result)
      } else if (result.status === 'rejected') {
        rejectedCount += 1
        stateMap.set(queueItem.request_id, {
          sync_state_id: syncStateId(partition, queueItem.request_id),
          partition_key: partitionKey(partition),
          terminal_id: partition.terminal_id,
          user_id: partition.user_id,
          role: STORAGE_ROLE,
          request_id: queueItem.request_id,
          status: 'rejected',
          payload: queueItem,
          attempt_count: stateMap.get(queueItem.request_id)?.attempt_count ?? 0,
          last_attempt_at: nowIso(),
          next_retry_at: null,
          last_error: messageFromSyncResult(result),
          server_status: result.http_status,
          review_reason: null,
          updated_at: nowIso(),
        })
      } else {
        needsReviewCount += 1
        stateMap.set(queueItem.request_id, {
          sync_state_id: syncStateId(partition, queueItem.request_id),
          partition_key: partitionKey(partition),
          terminal_id: partition.terminal_id,
          user_id: partition.user_id,
          role: STORAGE_ROLE,
          request_id: queueItem.request_id,
          status: 'needs_review',
          payload: queueItem,
          attempt_count: stateMap.get(queueItem.request_id)?.attempt_count ?? 0,
          last_attempt_at: nowIso(),
          next_retry_at: null,
          last_error: messageFromSyncResult(result),
          server_status: result.http_status,
          review_reason: messageFromSyncResult(result),
          updated_at: nowIso(),
        })
      }

      const nextIndex = remainingQueue.findIndex((entry) => entry.request_id === queueItem.request_id)
      if (nextIndex !== -1) {
        remainingQueue.splice(nextIndex, 1)
      }
    })

    await persistQueueAndStates(remainingQueue, stateMap, { statesFirst: true })

    return {
      processed_count: processedBatch.length,
      pending_count: remainingQueue.length,
      acked_count: ackedCount,
      rejected_count: rejectedCount,
      needs_review_count: needsReviewCount,
      next_retry_in_ms: nextRetryInMs(remainingQueue, stateMap),
    }
  } catch (error) {
    if (isAuthHttpError(error)) {
      return {
        processed_count: 0,
        pending_count: queue.length,
        acked_count: 0,
        rejected_count: 0,
        needs_review_count: 0,
        next_retry_in_ms: null,
        halted_reason: 'auth_failed',
      }
    }

    const reason = error instanceof Error ? error.message : 'sync failed'
    processedBatch.forEach((item) => {
      markPendingFailure(item, reason)
    })
    await persistQueueAndStates(queue, stateMap, { statesFirst: true })

    return {
      processed_count: 0,
      pending_count: queue.length,
      acked_count: 0,
      rejected_count: 0,
      needs_review_count: 0,
      next_retry_in_ms: nextRetryInMs(queue, stateMap),
      halted_reason: isNetworkRequestError(error) ? 'network' : 'unexpected',
    }
  }
}

export async function listCashierNeedsReviewItems(): Promise<CashierNeedsReviewItem[]> {
  const partition = getActiveCashierStoragePartition()
  if (!isCashierPartition(partition) || !isCashierOfflineDbAvailable()) {
    return []
  }

  const states = await readSyncStateRecords(partition)
  return states
    .filter((state) => state.status === 'needs_review' && state.payload)
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map((state) => ({
      request_id: state.request_id,
      payload: state.payload as CashierQueuePayload,
      reason: state.review_reason || state.last_error || null,
      updated_at: state.updated_at,
      server_status: state.server_status ?? null,
    }))
}

export async function requeueCashierNeedsReviewItem(requestId: string): Promise<boolean> {
  const partition = getActiveCashierStoragePartition()
  if (!isCashierPartition(partition)) {
    return false
  }

  const state = await readSyncStateByRequestId(partition, requestId)
  if (!state || state.status !== 'needs_review' || !state.payload) {
    return false
  }

  const queue = loadOfflineQueueForActivePartitionSync()
  const nextQueue = [state.payload, ...queue.filter((item) => item.request_id !== requestId)]
  await persistOfflineQueueForActivePartition(nextQueue)

  await upsertSyncState({
    ...state,
    status: 'pending',
    attempt_count: 0,
    next_retry_at: null,
    last_error: null,
    server_status: null,
    review_reason: null,
    updated_at: nowIso(),
  })

  return true
}

export async function dismissCashierNeedsReviewItem(requestId: string): Promise<boolean> {
  const partition = getActiveCashierStoragePartition()
  if (!isCashierPartition(partition) || !isCashierOfflineDbAvailable()) {
    return false
  }

  const queue = loadOfflineQueueForActivePartitionSync()
  const nextQueue = queue.filter((item) => item.request_id !== requestId)
  await persistOfflineQueueForActivePartition(nextQueue)
  await idbDelete(CASHIER_OFFLINE_STORES.sync_state, syncStateId(partition, requestId))
  return true
}
