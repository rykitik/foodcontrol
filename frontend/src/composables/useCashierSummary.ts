import { ref } from 'vue'

import { downloadCashierSummaryXlsx, getCashierDailySummary } from '@/services/api'
import { isAuthHttpError, isNetworkRequestError } from '@/services/http'
import { useAuthStore } from '@/stores/auth'
import type { CashierDailySummary } from '@/types'
import {
  formatCashierSummaryMonth,
  parseCashierSummaryMonthValue,
} from '@/utils/cashierSummaryPresentation'
import { saveBlob } from '@/utils/files'

const TODAY_DAYS = 1
const CASHIER_SUMMARY_OFFLINE_MESSAGE = 'Сводка доступна только при подключении к сети.'
const CASHIER_AUTH_ERROR_MESSAGE = 'Сессия истекла. Войдите снова.'

export interface CashierSummaryMonthOption {
  label: string
  value: string
}

function mapCashierSummaryError(error: unknown, fallbackMessage: string): string {
  if (isAuthHttpError(error)) {
    return CASHIER_AUTH_ERROR_MESSAGE
  }

  if (isNetworkRequestError(error)) {
    return CASHIER_SUMMARY_OFFLINE_MESSAGE
  }

  return error instanceof Error ? error.message : fallbackMessage
}

function formatMonthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function createMonthOptions(baseDate: Date): CashierSummaryMonthOption[] {
  return Array.from({ length: 12 }, (_, index) => {
    const optionDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - index, 1)
    return {
      label: formatCashierSummaryMonth(optionDate.getMonth() + 1, optionDate.getFullYear()),
      value: formatMonthValue(optionDate),
    }
  })
}

export function useCashierSummary() {
  const auth = useAuthStore()
  const now = new Date()

  const summary = ref<CashierDailySummary | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const offlineUnavailable = ref(false)
  const filterMode = ref<'today' | 'month'>('today')
  const selectedMonthValue = ref<string>(formatMonthValue(now))
  const monthOptions = createMonthOptions(now)

  function getRequestDays() {
    return TODAY_DAYS
  }

  function getSummaryOptions() {
    if (filterMode.value !== 'month') {
      return undefined
    }

    const { month, year } = parseCashierSummaryMonthValue(selectedMonthValue.value)
    return { month, year }
  }

  function buildFileSuffix() {
    if (!summary.value) {
      if (filterMode.value === 'month') {
        const { month, year } = parseCashierSummaryMonthValue(selectedMonthValue.value)
        return `${year}_${String(month).padStart(2, '0')}`
      }

      return 'today'
    }

    if (summary.value.filter.mode === 'month') {
      return `${summary.value.filter.year}_${String(summary.value.filter.month).padStart(2, '0')}`
    }

    return 'today'
  }

  async function loadSummary() {
    loading.value = true
    error.value = null
    offlineUnavailable.value = false

    try {
      const nextSummary = await getCashierDailySummary(
        getRequestDays(),
        auth.userBuilding ?? undefined,
        getSummaryOptions(),
      )

      summary.value = nextSummary

      if (nextSummary.filter.mode === 'month' && nextSummary.filter.month && nextSummary.filter.year) {
        selectedMonthValue.value = formatMonthValue(
          new Date(nextSummary.filter.year, nextSummary.filter.month - 1, 1),
        )
      }
    } catch (loadError) {
      offlineUnavailable.value = isNetworkRequestError(loadError)
      error.value = offlineUnavailable.value
        ? CASHIER_SUMMARY_OFFLINE_MESSAGE
        : mapCashierSummaryError(loadError, 'Не удалось загрузить дневную сводку.')
    } finally {
      loading.value = false
    }
  }

  function isCurrentMonthLoaded() {
    if (!summary.value || summary.value.filter.mode !== 'month') {
      return false
    }

    const { month, year } = parseCashierSummaryMonthValue(selectedMonthValue.value)
    return summary.value.filter.month === month && summary.value.filter.year === year
  }

  async function showToday() {
    filterMode.value = 'today'

    if (summary.value?.filter.mode === 'days') {
      return
    }

    await loadSummary()
  }

  async function showMonth() {
    filterMode.value = 'month'

    if (isCurrentMonthLoaded()) {
      return
    }

    await loadSummary()
  }

  async function selectMonth(value: string) {
    selectedMonthValue.value = value
    filterMode.value = 'month'

    if (isCurrentMonthLoaded()) {
      return
    }

    await loadSummary()
  }

  async function downloadSummaryXlsx() {
    error.value = null

    try {
      const blob = await downloadCashierSummaryXlsx(
        getRequestDays(),
        auth.userBuilding ?? undefined,
        getSummaryOptions(),
      )
      saveBlob(blob, `cashier_summary_${buildFileSuffix()}.xlsx`)
    } catch (downloadError) {
      offlineUnavailable.value = isNetworkRequestError(downloadError)
      error.value = offlineUnavailable.value
        ? CASHIER_SUMMARY_OFFLINE_MESSAGE
        : mapCashierSummaryError(downloadError, 'Не удалось выгрузить дневную сводку.')
    }
  }

  return {
    error,
    filterMode,
    loading,
    monthOptions,
    offlineUnavailable,
    selectedMonthValue,
    summary,
    downloadSummaryXlsx,
    loadSummary,
    selectMonth,
    showMonth,
    showToday,
  }
}
