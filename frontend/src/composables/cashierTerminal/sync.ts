import { ref, type Ref } from 'vue'

import { enqueueCashierOfflineSelection, runCashierOfflineQueueSync } from '@/services/cashierOfflineSync'
import { loadCashierQueue, saveCashierQueue, type PendingCashierSelection } from '@/utils/cashierSession'
import { localDateIso } from '@/utils/cashierTerminal'

import type { CashierTerminalStatusController } from './status'

interface CashierTerminalSyncAuth {
  token: string | null
}

interface CashierTerminalSyncControllerOptions {
  auth: CashierTerminalSyncAuth
  isOnline: Ref<boolean>
  queuedSelections: Ref<PendingCashierSelection[]>
  hasCashierOfflineContext: () => boolean
  refreshStats: () => Promise<void>
  pushEvent: (message: string, tone?: 'info' | 'success' | 'warning' | 'danger') => void
  notifyServerReachable: () => void
  notifyServerUnavailable: () => void
  statusController: Pick<
    CashierTerminalStatusController,
    'handleRetryUnavailable' | 'handleQueueEmpty' | 'handleQueueOffline' | 'handleQueueProcessed'
  >
}

export interface CashierTerminalSyncController {
  syncingQueue: Ref<boolean>
  restoreQueuedSelections: () => void
  resetSyncState: () => void
  hasPendingMealConflict: (request: PendingCashierSelection) => boolean
  enqueuePendingSelection: (request: PendingCashierSelection) => Promise<void>
  syncPendingSelections: (force?: boolean) => Promise<void>
  retryPendingSelections: () => Promise<void>
  handleOnlineReconnected: () => Promise<void>
  clearRetryTimer: () => void
}

export function createCashierTerminalSyncController(
  options: CashierTerminalSyncControllerOptions,
): CashierTerminalSyncController {
  const syncingQueue = ref(false)
  let syncRetryTimer: ReturnType<typeof setTimeout> | null = null

  function persistQueue() {
    saveCashierQueue(options.queuedSelections.value)
  }

  function restoreQueuedSelections() {
    options.queuedSelections.value = loadCashierQueue()
  }

  function clearRetryTimer() {
    if (!syncRetryTimer) {
      return
    }

    clearTimeout(syncRetryTimer)
    syncRetryTimer = null
  }

  function scheduleRetry(delayMs: number | null) {
    clearRetryTimer()
    if (
      !delayMs ||
      delayMs <= 0 ||
      !options.queuedSelections.value.length ||
      !options.isOnline.value ||
      !options.hasCashierOfflineContext()
    ) {
      return
    }

    syncRetryTimer = setTimeout(() => {
      void syncPendingSelections()
    }, delayMs)
  }

  function resetSyncState() {
    clearRetryTimer()
    options.queuedSelections.value = []
    syncingQueue.value = false
  }

  function hasPendingMealConflict(request: PendingCashierSelection): boolean {
    const requestIssueDate = request.issue_date || localDateIso()
    return options.queuedSelections.value.some((queuedItem) => {
      if ((queuedItem.issue_date || localDateIso()) !== requestIssueDate) {
        return false
      }

      const sameStudent =
        queuedItem.student_id && request.student_id && queuedItem.student_id === request.student_id
      const sameTicket = queuedItem.ticket_id && request.ticket_id && queuedItem.ticket_id === request.ticket_id
      if (!sameStudent && !sameTicket) {
        return false
      }

      return queuedItem.selected_meals.some((meal) => request.selected_meals.includes(meal))
    })
  }

  async function enqueuePendingSelection(request: PendingCashierSelection) {
    await enqueueCashierOfflineSelection(request)
    restoreQueuedSelections()
    persistQueue()
  }

  async function syncPendingSelections(force = false) {
    if (
      !options.hasCashierOfflineContext() ||
      !options.isOnline.value ||
      syncingQueue.value ||
      !options.queuedSelections.value.length
    ) {
      return
    }

    syncingQueue.value = true
    try {
      const result = await runCashierOfflineQueueSync({
        token: options.auth.token,
        force,
      })

      restoreQueuedSelections()
      persistQueue()

      if (!result.halted_reason) {
        options.notifyServerReachable()
      }

      if (result.acked_count) {
        options.pushEvent(`Синхронизация: подтверждено ${result.acked_count}`, 'success')
      }
      if (result.rejected_count) {
        options.pushEvent(`Синхронизация: отклонено ${result.rejected_count}`, 'warning')
      }
      if (result.needs_review_count) {
        options.pushEvent(`Синхронизация: требует проверки ${result.needs_review_count}`, 'warning')
      }
      if (result.halted_reason === 'auth_failed') {
        options.pushEvent('Синхронизация остановлена: требуется повторный вход', 'danger')
      } else if (result.halted_reason === 'network') {
        options.notifyServerUnavailable()
        options.pushEvent('Синхронизация остановлена: нет связи', 'warning')
      } else if (result.halted_reason === 'unexpected') {
        options.pushEvent('Синхронизация остановлена: ошибка сервера', 'danger')
      }

      scheduleRetry(result.next_retry_in_ms)
    } finally {
      syncingQueue.value = false
      await options.refreshStats()
    }
  }

  async function retryPendingSelections() {
    if (!options.hasCashierOfflineContext()) {
      options.statusController.handleRetryUnavailable()
      return
    }

    if (!options.queuedSelections.value.length) {
      options.statusController.handleQueueEmpty()
      return
    }

    if (!options.isOnline.value) {
      options.statusController.handleQueueOffline()
      return
    }

    await syncPendingSelections(true)
    options.statusController.handleQueueProcessed(options.queuedSelections.value.length)
  }

  async function handleOnlineReconnected() {
    await syncPendingSelections()
  }

  return {
    syncingQueue,
    restoreQueuedSelections,
    resetSyncState,
    hasPendingMealConflict,
    enqueuePendingSelection,
    syncPendingSelections,
    retryPendingSelections,
    handleOnlineReconnected,
    clearRetryTimer,
  }
}
