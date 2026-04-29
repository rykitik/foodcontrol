import { computed, onMounted, ref, watch } from 'vue'

import { getTodayStats } from '@/services/api'
import {
  loadCashierOfflineOpsSummaryForUser,
  warmCashierOfflineOpsForSession,
} from '@/services/cashierOfflineOps'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import type { DashboardStats } from '@/types'

export function useCashierLauncher() {
  const auth = useAuthStore()

  const stats = ref<DashboardStats | null>(null)
  const loading = ref(true)
  const offlineLoading = ref(true)
  const statsAvailability = ref<'unknown' | 'ready' | 'network_unreachable' | 'auth_error'>('unknown')
  const queueCount = ref(0)
  const eventCount = ref(0)
  const needsReviewCount = ref(0)
  const snapshotState = ref<'ready' | 'stale' | 'missing'>('missing')
  const snapshotAgeMs = ref<number | null>(null)
  const isCashierRole = computed(() => auth.user?.role === 'cashier')

  const buildingLabel = computed(() => auth.user?.building_name || 'Все корпуса')
  const servingLabel = computed(() => {
    if (loading.value) {
      return 'Проверка режима'
    }
    if (!stats.value) {
      return 'Статус недоступен'
    }
    return stats.value.serving_today ? 'Выдача открыта' : 'Выдача закрыта'
  })
  const servingTone = computed(() => {
    if (!stats.value) {
      return 'neutral'
    }
    return stats.value.serving_today ? 'success' : 'warn'
  })
  const snapshotTone = computed(() => {
    if (offlineLoading.value) {
      return 'neutral'
    }
    if (snapshotState.value === 'ready') {
      return 'success'
    }
    if (snapshotState.value === 'stale') {
      return 'warn'
    }
    return 'danger'
  })
  const snapshotLabel = computed(() => {
    if (offlineLoading.value) {
      return 'Оффлайн-данные загружаются'
    }
    if (snapshotState.value === 'ready') {
      return 'Оффлайн-данные готовы'
    }
    if (snapshotState.value === 'stale') {
      return 'Оффлайн-данные устарели'
    }
    return 'Оффлайн-данные отсутствуют'
  })
  const offlineLoadingMessage = computed(() => {
    if (!offlineLoading.value) {
      return ''
    }
    return 'Подготавливаем оффлайн-данные для кассы...'
  })
  const summaryOfflineUnavailable = computed(() => statsAvailability.value === 'network_unreachable')
  const summaryCardSubtitle = computed(() =>
    summaryOfflineUnavailable.value ? 'Доступно только при подключении к сети' : 'Отчёты и итоги смены',
  )
  const summaryCardNote = computed(() =>
    summaryOfflineUnavailable.value ? 'Только с сетью' : '',
  )
  const preflightMessage = computed(() => {
    if (offlineLoading.value) {
      return ''
    }
    if (needsReviewCount.value > 0) {
      return `Есть операций на проверке: ${needsReviewCount.value}`
    }
    if (snapshotState.value === 'stale') {
      return 'Локальные оффлайн-данные устарели. При первой возможности подключитесь к интернету и обновите их.'
    }
    if (snapshotState.value === 'missing') {
      return 'Локальные оффлайн-данные неполные или отсутствуют. Работа без интернета может быть недоступна.'
    }
    return ''
  })

  function resetLocal() {
    queueCount.value = 0
    eventCount.value = 0
    needsReviewCount.value = 0
    snapshotState.value = 'missing'
    snapshotAgeMs.value = null
  }

  async function refreshLocal() {
    if (!isCashierRole.value || !auth.user?.id) {
      resetLocal()
      return
    }

    const summary = await loadCashierOfflineOpsSummaryForUser(auth.user.id)
    queueCount.value = summary.queue_count
    eventCount.value = summary.event_count
    needsReviewCount.value = summary.needs_review_count
    snapshotState.value = summary.snapshot_state
    snapshotAgeMs.value = summary.snapshot_age_ms
  }

  async function warmOfflineState() {
    if (!isCashierRole.value || !auth.user?.id) {
      offlineLoading.value = false
      resetLocal()
      return
    }

    offlineLoading.value = true

    try {
      await warmCashierOfflineOpsForSession({
        token: auth.token,
        user: auth.user,
        forceSnapshotRefresh: true,
      }).catch(() => undefined)

      await refreshLocal()
    } finally {
      offlineLoading.value = false
    }
  }

  async function loadData() {
    loading.value = true
    statsAvailability.value = 'unknown'
    await warmOfflineState()

    try {
      stats.value = await getTodayStats(auth.userBuilding ?? undefined)
      statsAvailability.value = 'ready'
    } catch (error) {
      stats.value = null

      if (isNetworkRequestError(error) || isAuthHttpError(error)) {
        statsAvailability.value = isNetworkRequestError(error) ? 'network_unreachable' : 'auth_error'
        return
      }

      throw error
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await loadData()
  })

  watch(
    () => [auth.user?.id ?? null, auth.user?.role ?? null] as const,
    (nextSession, previousSession) => {
      if (!previousSession) {
        return
      }

      if (nextSession[0] === previousSession[0] && nextSession[1] === previousSession[1]) {
        return
      }

      stats.value = null
      void loadData()
    },
  )

  return {
    auth,
    stats,
    loading,
    offlineLoading,
    queueCount,
    eventCount,
    needsReviewCount,
    snapshotAgeMs,
    snapshotLabel,
    snapshotState,
    snapshotTone,
    summaryOfflineUnavailable,
    summaryCardSubtitle,
    summaryCardNote,
    buildingLabel,
    servingLabel,
    servingTone,
    offlineLoadingMessage,
    preflightMessage,
  }
}
