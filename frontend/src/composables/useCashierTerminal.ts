import { useOnline } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useCashierAutoReset } from '@/composables/useCashierAutoReset'
import { createCashierTerminalConnectivityController } from '@/composables/cashierTerminal/connectivity'
import { createCashierTerminalLookupController } from '@/composables/cashierTerminal/lookup'
import { createCashierTerminalQueueController } from '@/composables/cashierTerminal/queue'
import {
  buildCurrentStudentView,
  INITIAL_STATUS,
  mealsLabel,
  type CashierStatusState,
} from '@/composables/cashierTerminal/shared'
import { createCashierTerminalStatusController } from '@/composables/cashierTerminal/status'
import { createCashierTerminalSyncController } from '@/composables/cashierTerminal/sync'
import { getTodayStats } from '@/services/api'
import { ensureCashierOfflineGrantBootstrap } from '@/services/cashierOfflineGrant'
import { runCashierOfflineMaintenance } from '@/services/cashierOfflineMaintenance'
import { getActiveCashierStoragePartition } from '@/services/cashierOfflineStorage'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import type { CashierLookupResult, DashboardStats, MealType } from '@/types'
import { pushCashierEvent, type PendingCashierSelection } from '@/utils/cashierSession'
import { convertRuKeyboardLayoutToLatin, normalizeTicketLookupCode } from '@/utils/keyboardLayout'

export function useCashierTerminal() {
  const auth = useAuthStore()
  const isOnline = useOnline()

  const queryValue = ref('')
  const lookup = ref<CashierLookupResult | null>(null)
  const stats = ref<DashboardStats | null>(null)
  const selectedMeals = ref<MealType[]>([])
  const queuedSelections = ref<PendingCashierSelection[]>([])
  const loading = ref(false)
  const status = ref<CashierStatusState>({ ...INITIAL_STATUS })
  const hasOfflineSnapshot = ref(false)
  const snapshotRefreshing = ref(false)
  const cashierTerminalReady = ref(false)
  const lastQueryValue = ref('')

  const statusClass = computed(() => `cashier-terminal-status state-${status.value.kind}`)
  const statusKind = computed(() => status.value.kind)
  const queueCount = computed(() => queuedSelections.value.length)
  const requiresManualMealSelection = computed(() => (lookup.value?.remaining_meals?.length ?? 0) > 1)
  const serviceBlocked = computed(() => stats.value?.serving_today === false)
  const lookupStatuses = computed(() => lookup.value?.today_statuses ?? [])
  const allowedMealsLabel = computed(() =>
    lookup.value?.allowed_meals?.length ? mealsLabel(lookup.value.allowed_meals) : '—',
  )
  const selectionLabel = computed(() =>
    selectedMeals.value.length ? mealsLabel(selectedMeals.value) : 'Не выбрано',
  )
  const currentStudent = computed(() => buildCurrentStudentView(lookup.value))

  function pushEvent(message: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info') {
    pushCashierEvent(message, tone)
  }

  function hasCashierOfflineContext() {
    return auth.user?.role === 'cashier' && Boolean(getActiveCashierStoragePartition())
  }

  const { autoResetActive, autoResetKey, autoResetDelayMs, scheduleAutoReset, cancelAutoReset } =
    useCashierAutoReset(() => resetScreen(false))

  const statusController = createCashierTerminalStatusController({
    status,
    pushEvent,
    scheduleAutoReset,
  })

  async function refreshStats() {
    if (!isOnline.value) {
      return
    }

    try {
      stats.value = await getTodayStats(auth.userBuilding ?? undefined)
      connectivityController.markServerReachable()
    } catch (error) {
      if (isNetworkRequestError(error)) {
        connectivityController.markServerUnavailable()
        return
      }

      if (isAuthHttpError(error)) {
        statusController.handleAuthFailure('Обновление статуса кассы')
        return
      }

      throw error
    }
  }

  const connectivityController = createCashierTerminalConnectivityController({
    auth,
    pushEvent,
    handleAuthFailure: statusController.handleAuthFailure,
    onServerReconnected: async () => {
      await lookupController.refreshOfflineSnapshot()
      if (!auth.isAuthenticated) {
        return
      }

      await syncController.handleOnlineReconnected()
      await refreshStats()
    },
  })

  const lookupController = createCashierTerminalLookupController({
    auth,
    isOnline,
    queryValue,
    lastQueryValue,
    lookup,
    loading,
    hasOfflineSnapshot,
    snapshotRefreshing,
    hasCashierOfflineContext,
    resetSelection,
    cancelAutoReset,
    notifyServerReachable: connectivityController.markServerReachable,
    notifyServerUnavailable: connectivityController.markServerUnavailable,
    pushEvent,
    statusController,
  })

  const syncController = createCashierTerminalSyncController({
    auth,
    isOnline,
    queuedSelections,
    hasCashierOfflineContext,
    refreshStats,
    pushEvent,
    notifyServerReachable: connectivityController.markServerReachable,
    notifyServerUnavailable: connectivityController.markServerUnavailable,
    statusController,
  })

  const queueController = createCashierTerminalQueueController({
    auth,
    isOnline,
    lookup,
    selectedMeals,
    loading,
    lastQueryValue,
    hasCashierOfflineContext,
    cancelAutoReset,
    refreshStats,
    resolveLookupWithFallback: lookupController.resolveLookupWithFallback,
    notifyServerReachable: connectivityController.markServerReachable,
    notifyServerUnavailable: connectivityController.markServerUnavailable,
    statusController,
    syncController,
  })

  const terminalStateLabel = computed(() => {
    if (syncController.syncingQueue.value) {
      return 'Синхронизация'
    }
    if (connectivityController.probingConnection.value) {
      return 'Проверка связи'
    }
    if (!connectivityController.serverReachable.value) {
      return 'Нет связи с сервером'
    }
    if (loading.value) {
      return 'Проверка талона'
    }
    return 'Готово'
  })

  function resetSelection() {
    queueController.resetSelection()
  }

  function resetTerminalState() {
    cashierTerminalReady.value = false
    cancelAutoReset()
    connectivityController.reset()
    syncController.resetSyncState()
    lookup.value = null
    queueController.resetSelection()
    loading.value = false
    lastQueryValue.value = ''
    statusController.resetStatus()
    snapshotRefreshing.value = false
    hasOfflineSnapshot.value = false
  }

  function resetScreen(pushLog = true) {
    cancelAutoReset()
    lookup.value = null
    lastQueryValue.value = ''
    queryValue.value = ''
    queueController.resetSelection()
    statusController.resetStatus()
    if (pushLog) {
      pushEvent('Экран очищен', 'info')
    }
  }

  function toggleMeal(mealType: MealType) {
    queueController.toggleMeal(mealType)
  }

  async function confirmCurrentSelection() {
    await queueController.confirmCurrentSelection()
  }

  async function retryPendingSelections() {
    await syncController.retryPendingSelections()
  }

  function setQueryValue(value: string) {
    queryValue.value = convertRuKeyboardLayoutToLatin(value)
  }

  async function submitLookupByCode(code: string) {
    if (autoResetActive.value) {
      return
    }

    const rawValue = normalizeTicketLookupCode(code)
    if (!rawValue || loading.value) {
      return
    }

    queryValue.value = ''
    await lookupController.handleTicketLookup(rawValue, queueController.commitSelection)
  }

  async function submitLookup() {
    await submitLookupByCode(queryValue.value)
  }

  async function initializeCashierTerminalSession() {
    resetTerminalState()

    if (auth.user?.role === 'cashier') {
      await ensureCashierOfflineGrantBootstrap({
        token: auth.token,
        user: auth.user,
      }).catch(() => undefined)

      await runCashierOfflineMaintenance({ userId: auth.user.id })
      syncController.restoreQueuedSelections()
      await lookupController.loadOfflineSnapshotAvailability()

      if (isOnline.value) {
        await lookupController.refreshOfflineSnapshot()
        if (!auth.isAuthenticated) {
          return
        }
      }
    } else {
      queuedSelections.value = []
      hasOfflineSnapshot.value = false
    }

    try {
      await refreshStats()
    } catch {
      stats.value = null
    }

    if (!auth.isAuthenticated) {
      return
    }

    resetScreen(false)
    pushEvent('Терминал открыт', 'info')

    if (isOnline.value) {
      void syncController.syncPendingSelections()
    }

    cashierTerminalReady.value = true
  }

  watch(
    () => [auth.user?.id ?? null, auth.user?.role ?? null] as const,
    (nextSession, previousSession) => {
      if (!previousSession) {
        return
      }

      if (nextSession[0] === previousSession[0] && nextSession[1] === previousSession[1]) {
        return
      }

      resetTerminalState()
      stats.value = null
    },
  )

  watch(isOnline, (online) => {
    if (online) {
      connectivityController.handleBrowserOnline()
      return
    }

    syncController.clearRetryTimer()
    connectivityController.handleBrowserOffline()
  })

  return {
    auth,
    queryValue,
    status,
    statusClass,
    statusKind,
    lookup,
    stats,
    selectedMeals,
    requiresManualMealSelection,
    loading,
    queueCount,
    serviceBlocked,
    terminalStateLabel,
    lastQueryValue,
    lookupStatuses,
    allowedMealsLabel,
    selectionLabel,
    currentStudent,
    autoResetActive,
    autoResetKey,
    autoResetDelayMs,
    cashierTerminalReady,
    initializeCashierTerminalSession,
    resetScreen,
    setQueryValue,
    submitLookupByCode,
    submitLookup,
    toggleMeal,
    confirmCurrentSelection,
    retryPendingSelections,
  }
}
