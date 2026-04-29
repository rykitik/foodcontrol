import { computed, ref, watch, type Ref } from 'vue'

import { formatLocalDateToIso } from '@/utils/localDate'
import { getMonthPeriod } from '@/utils/socialPedagogMonth'

export type TicketPeriodType = 'month' | 'partial' | 'range'

interface UseTicketPeriodOptions {
  month: Ref<number>
  year: Ref<number>
}

function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right)
}

function clampDate(value: string, min: string, max: string): string {
  if (compareIsoDates(value, min) < 0) {
    return min
  }
  if (compareIsoDates(value, max) > 0) {
    return max
  }
  return value
}

export function useTicketPeriod(options: UseTicketPeriodOptions) {
  const periodType = ref<TicketPeriodType>('month')
  const startDate = ref('')
  const endDate = ref('')

  const monthPeriod = computed(() => getMonthPeriod(options.year.value, options.month.value))
  const todayIso = computed(() => formatLocalDateToIso(new Date()))
  const monthStartFloor = computed(() =>
    compareIsoDates(monthPeriod.value.startDate, todayIso.value) < 0 ? todayIso.value : monthPeriod.value.startDate,
  )

  function syncToMonthPeriod() {
    startDate.value = monthStartFloor.value
    endDate.value = monthPeriod.value.endDate
  }

  function setPeriodType(nextType: TicketPeriodType) {
    periodType.value = nextType
    if (nextType === 'month' || nextType === 'partial') {
      syncToMonthPeriod()
    }
  }

  function setStartDate(value: string) {
    if (!value) {
      startDate.value = ''
      return
    }

    startDate.value =
      periodType.value === 'partial'
        ? clampDate(value, monthStartFloor.value, monthPeriod.value.endDate)
        : value
  }

  function setEndDate(value: string) {
    if (!value) {
      endDate.value = ''
      return
    }

    endDate.value =
      periodType.value === 'partial'
        ? clampDate(value, monthStartFloor.value, monthPeriod.value.endDate)
        : value
  }

  const validationMessage = computed(() => {
    if (periodType.value === 'month') {
      return ''
    }

    if (!startDate.value || !endDate.value) {
      return 'Укажите начало и окончание периода'
    }

    if (compareIsoDates(startDate.value, todayIso.value) < 0) {
      return 'При выдаче дата начала не может быть раньше сегодняшнего дня'
    }

    if (periodType.value === 'partial') {
      if (
        compareIsoDates(startDate.value, monthStartFloor.value) < 0 ||
        compareIsoDates(endDate.value, monthPeriod.value.endDate) > 0
      ) {
        return 'Часть месяца должна оставаться в пределах выбранного месяца'
      }
    }

    if (compareIsoDates(endDate.value, startDate.value) < 0) {
      return 'Дата окончания не может быть раньше даты начала'
    }

    return ''
  })

  const requestPeriod = computed(() => ({
    start_date: periodType.value === 'month' ? monthStartFloor.value : startDate.value,
    end_date: periodType.value === 'month' ? monthPeriod.value.endDate : endDate.value,
  }))

  const startDateMin = computed(() => (periodType.value === 'partial' ? monthStartFloor.value : todayIso.value))
  const endDateMax = computed(() => (periodType.value === 'partial' ? monthPeriod.value.endDate : ''))

  function reset() {
    periodType.value = 'month'
    syncToMonthPeriod()
  }

  watch(
    [options.month, options.year],
    () => {
      if (periodType.value === 'range') {
        return
      }
      syncToMonthPeriod()
    },
    { immediate: true },
  )

  return {
    endDate,
    endDateMax,
    periodType,
    requestPeriod,
    reset,
    setEndDate,
    setPeriodType,
    setStartDate,
    startDate,
    startDateMin,
    validationMessage,
  }
}
