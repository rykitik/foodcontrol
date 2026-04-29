import { ref } from 'vue'

import { getCashierJournal } from '@/services/api'
import { runCashierOfflineMaintenance } from '@/services/cashierOfflineMaintenance'
import {
  fetchAndStoreCashierOfflineSnapshot,
  readCashierOfflineSnapshotDatasetHealth,
} from '@/services/cashierOfflineSnapshot'
import {
  listCashierNeedsReviewItems,
  type CashierNeedsReviewItem,
} from '@/services/cashierOfflineSync'
import {
  readSnapshotMeta,
  readTerminalMetaForActivePartitionSync,
  restoreCashierStoragePartitionForUser,
} from '@/services/cashierOfflineStorage'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import type { CashierJournal, CashierJournalOfflineState } from '@/types'
import {
  loadCashierEvents,
  loadCashierQueue,
  type CashierEventEntry,
  type PendingCashierSelection,
} from '@/utils/cashierSession'

const CASHIER_JOURNAL_OFFLINE_MESSAGE = 'Серверная проверка журнала доступна только при подключении к сети.'
const CASHIER_JOURNAL_AUTH_MESSAGE = 'Сессия истекла. Войдите снова.'

function createEmptyOfflineState(): CashierJournalOfflineState {
  return {
    has_partition: false,
    is_online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    terminal_display_name: null,
    snapshot_ready: false,
    snapshot_students_count: 0,
    snapshot_tickets_count: 0,
    snapshot_categories_count: 0,
    generated_at: null,
    service_date: null,
    queue_count: 0,
    review_count: 0,
    events_count: 0,
  }
}

function mapCashierJournalError(error: unknown, fallbackMessage: string): string {
  if (isAuthHttpError(error)) {
    return CASHIER_JOURNAL_AUTH_MESSAGE
  }

  if (isNetworkRequestError(error)) {
    return CASHIER_JOURNAL_OFFLINE_MESSAGE
  }

  return error instanceof Error ? error.message : fallbackMessage
}

export function useCashierJournal() {
  const auth = useAuthStore()

  const journal = ref<CashierJournal | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const offlineUnavailable = ref(false)
  const events = ref<CashierEventEntry[]>([])
  const queue = ref<PendingCashierSelection[]>([])
  const reviewItems = ref<CashierNeedsReviewItem[]>([])
  const offlineState = ref<CashierJournalOfflineState>(createEmptyOfflineState())

  function resetLocalState() {
    events.value = []
    queue.value = []
    reviewItems.value = []
    offlineState.value = createEmptyOfflineState()
  }

  async function refreshLocalState() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

    if (auth.user?.role !== 'cashier' || !auth.user.id) {
      resetLocalState()
      return
    }

    const partition = await restoreCashierStoragePartitionForUser(auth.user.id)
    if (!partition) {
      resetLocalState()
      return
    }

    await runCashierOfflineMaintenance({ userId: auth.user.id })

    if (isOnline && auth.token) {
      try {
        await fetchAndStoreCashierOfflineSnapshot(auth.token)
      } catch (snapshotError) {
        if (!isNetworkRequestError(snapshotError) && !isAuthHttpError(snapshotError)) {
          console.warn('Failed to refresh cashier snapshot for journal:', snapshotError)
        }
      }
    }

    const [needsReview, snapshotMeta, datasetHealth] = await Promise.all([
      listCashierNeedsReviewItems(),
      readSnapshotMeta(partition),
      readCashierOfflineSnapshotDatasetHealth(partition),
    ])

    const latestEvents = loadCashierEvents(30)
    const currentQueue = loadCashierQueue()
    const terminalMeta = readTerminalMetaForActivePartitionSync()

    events.value = latestEvents
    queue.value = currentQueue
    reviewItems.value = needsReview
    offlineState.value = {
      has_partition: true,
      is_online: isOnline,
      terminal_display_name: terminalMeta?.display_name ?? null,
      snapshot_ready: datasetHealth.ready,
      snapshot_students_count: datasetHealth.students_count,
      snapshot_tickets_count: datasetHealth.tickets_count,
      snapshot_categories_count: datasetHealth.categories_count,
      generated_at: snapshotMeta?.generated_at ?? null,
      service_date: snapshotMeta?.service_date ?? null,
      queue_count: currentQueue.length,
      review_count: needsReview.length,
      events_count: latestEvents.length,
    }
  }

  async function loadJournal() {
    loading.value = true
    error.value = null
    offlineUnavailable.value = false

    await refreshLocalState()

    try {
      journal.value = await getCashierJournal(auth.userBuilding ?? undefined)
    } catch (loadError) {
      offlineUnavailable.value = isNetworkRequestError(loadError)
      error.value = mapCashierJournalError(loadError, 'Не удалось загрузить журнал кассы.')
    } finally {
      loading.value = false
    }
  }

  return {
    error,
    events,
    journal,
    loading,
    offlineState,
    offlineUnavailable,
    queue,
    reviewItems,
    loadJournal,
    refreshLocalState,
  }
}
