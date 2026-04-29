import { ensureCashierOfflineGrantBootstrap } from '@/services/cashierOfflineGrant'
import { CASHIER_SNAPSHOT_FRESH_MS } from '@/config/runtime'
import { runCashierOfflineMaintenance } from '@/services/cashierOfflineMaintenance'
import {
  fetchAndStoreCashierOfflineSnapshot,
  readCashierOfflineSnapshotDatasetHealth,
} from '@/services/cashierOfflineSnapshot'
import {
  readSnapshotMeta,
  restoreCashierStoragePartitionForUser,
} from '@/services/cashierOfflineStorage'
import { listCashierNeedsReviewItems } from '@/services/cashierOfflineSync'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { loadCashierEvents, loadCashierQueue } from '@/utils/cashierSession'
import { parseCashierSnapshotTimestamp } from '@/utils/cashierSnapshotTime'
import type { User } from '@/types'

const STORAGE_ROLE = 'cashier' as const

export type CashierOfflineSnapshotState = 'ready' | 'stale' | 'missing'

export interface CashierOfflineOpsSummary {
  queue_count: number
  event_count: number
  needs_review_count: number
  snapshot_state: CashierOfflineSnapshotState
  snapshot_age_ms: number | null
}

function emptySummary(): CashierOfflineOpsSummary {
  return {
    queue_count: 0,
    event_count: 0,
    needs_review_count: 0,
    snapshot_state: 'missing',
    snapshot_age_ms: null,
  }
}

function toSnapshotState(snapshotAgeMs: number | null, datasetReady: boolean): CashierOfflineSnapshotState {
  if (!datasetReady || snapshotAgeMs === null) {
    return 'missing'
  }

  if (snapshotAgeMs <= CASHIER_SNAPSHOT_FRESH_MS) {
    return 'ready'
  }

  return 'stale'
}

function isCashierUser(user: User | null | undefined): user is User & { role: 'cashier' } {
  return Boolean(user && user.role === STORAGE_ROLE)
}

export async function warmCashierOfflineOpsForSession(params: {
  token: string | null
  user: User | null
  forceSnapshotRefresh?: boolean
}): Promise<void> {
  if (!params.token || !isCashierUser(params.user)) {
    return
  }

  await ensureCashierOfflineGrantBootstrap({
    token: params.token,
    user: params.user,
  })

  const summary = await loadCashierOfflineOpsSummaryForUser(params.user.id)
  if (summary.snapshot_state === 'ready' && !params.forceSnapshotRefresh) {
    return
  }

  try {
    await fetchAndStoreCashierOfflineSnapshot(params.token)
  } catch (error) {
    if (isNetworkRequestError(error) || isAuthHttpError(error)) {
      return
    }

    throw error
  }
}

export async function loadCashierOfflineOpsSummaryForUser(userId: string): Promise<CashierOfflineOpsSummary> {
  const partition = await restoreCashierStoragePartitionForUser(userId)
  if (!partition) {
    return emptySummary()
  }

  await runCashierOfflineMaintenance({ userId })

  const [reviewItems, snapshotMeta, snapshotHealth] = await Promise.all([
    listCashierNeedsReviewItems(),
    readSnapshotMeta(partition),
    readCashierOfflineSnapshotDatasetHealth(partition),
  ])

  const freshnessMarker = snapshotMeta?.freshness_ts || snapshotMeta?.generated_at || null
  const freshnessMs = parseCashierSnapshotTimestamp(freshnessMarker)
  const snapshotAgeMs = freshnessMs === null ? null : Math.max(0, Date.now() - freshnessMs)

  return {
    queue_count: loadCashierQueue().length,
    event_count: loadCashierEvents(30).length,
    needs_review_count: reviewItems.length,
    snapshot_state: toSnapshotState(snapshotAgeMs, snapshotHealth.ready),
    snapshot_age_ms: snapshotAgeMs,
  }
}
