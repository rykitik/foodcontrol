import { computed, reactive, ref, watch } from 'vue'

import { createHoliday, createHolidayRange, deleteHoliday, listHolidays, updateHoliday } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type {
  HolidayCalendarCell,
  HolidayEditForm,
  HolidayEntry,
  HolidayRangeCreateResponse,
  HolidayRangeForm,
  HolidaySelectedDateMeta,
} from '@/types'
import {
  isIsoDateInMonth,
  isValidIsoDate,
  monthPrefix,
  monthStartIso,
  toIsoDate,
} from '@/utils/holidayCalendar'
import {
  composeHolidayTitle,
  hydrateHolidayFormFields,
} from '@/utils/holidayCalendarPresentation'

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function buildRangeSuccessMessage(result: HolidayRangeCreateResponse): string {
  if (!result.created_count && result.skipped_count) {
    return `Все даты диапазона уже существуют: ${result.skipped_count}`
  }

  if (result.created_count && !result.skipped_count) {
    return `Добавлено дат: ${result.created_count}`
  }

  return `Добавлено дат: ${result.created_count}. Пропущено существующих дат: ${result.skipped_count}`
}

export function useHolidayCalendar() {
  const auth = useAuthStore()
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1

  const currentMonth = ref(todayMonth)
  const currentYear = ref(todayYear)
  const includeInactive = ref(true)
  const allHolidays = ref<HolidayEntry[]>([])
  const selectedDate = ref(monthStartIso(currentYear.value, currentMonth.value))
  const selectedHolidayId = ref<number | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const successMessage = ref('')
  const errorMessage = ref('')

  const holidays = computed(() =>
    includeInactive.value ? allHolidays.value : allHolidays.value.filter((entry) => entry.is_active),
  )

  const holidayForm = reactive<HolidayEditForm>({
    holiday_date: selectedDate.value,
    reason_type: 'other',
    comment: '',
    is_active: true,
  })

  const rangeForm = reactive<HolidayRangeForm>({
    start_date: selectedDate.value,
    end_date: selectedDate.value,
    reason_type: 'other',
    comment: '',
    is_active: true,
  })

  const canEdit = computed(() => auth.effectiveRole === 'head_social')
  const selectedHoliday = computed(() => holidays.value.find((entry) => entry.id === selectedHolidayId.value) ?? null)

  const selectedDateMeta = computed<HolidaySelectedDateMeta>(() => {
    if (!isValidIsoDate(holidayForm.holiday_date)) {
      return { weekend: false, holiday: null }
    }

    const dateValue = new Date(`${holidayForm.holiday_date}T00:00:00`)
    const weekend = dateValue.getDay() === 0
    const holiday = holidays.value.find((entry) => entry.holiday_date === holidayForm.holiday_date) ?? null
    return { weekend, holiday }
  })

  const calendarCells = computed<(HolidayCalendarCell | null)[]>(() => {
    const firstDay = new Date(currentYear.value, currentMonth.value - 1, 1)
    const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate()
    const offset = (firstDay.getDay() + 6) % 7
    const cells: (HolidayCalendarCell | null)[] = Array.from({ length: offset }, () => null)
    const holidayByDate = new Map(holidays.value.map((entry) => [entry.holiday_date, entry]))

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateValue = new Date(currentYear.value, currentMonth.value - 1, day)
      const isoDate = toIsoDate(dateValue)
      cells.push({
        isoDate,
        day,
        isWeekend: dateValue.getDay() === 0,
        holiday: holidayByDate.get(isoDate) ?? null,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    return cells
  })

  function resetAlerts() {
    successMessage.value = ''
    errorMessage.value = ''
  }

  function hydrateHolidayForm(entry: HolidayEntry | null, dateValue: string) {
    selectedHolidayId.value = entry?.id ?? null
    holidayForm.holiday_date = dateValue
    holidayForm.is_active = entry?.is_active ?? true
    hydrateHolidayFormFields(holidayForm, entry)
  }

  function normalizeCurrentPeriod() {
    const nextMonth = Number(currentMonth.value)
    const nextYear = Number(currentYear.value)

    currentMonth.value = Number.isInteger(nextMonth) && nextMonth >= 1 && nextMonth <= 12 ? nextMonth : todayMonth
    currentYear.value = Number.isInteger(nextYear) && nextYear >= 2020 && nextYear <= 2100 ? nextYear : todayYear
  }

  function syncRangeFormDates(dateValue: string) {
    if (!isIsoDateInMonth(rangeForm.start_date, currentYear.value, currentMonth.value)) {
      rangeForm.start_date = dateValue
    }

    if (!isIsoDateInMonth(rangeForm.end_date, currentYear.value, currentMonth.value)) {
      rangeForm.end_date = dateValue
    }
  }

  function syncSelectedDate(dateValue: string) {
    selectedDate.value = dateValue
    const entry = holidays.value.find((item) => item.holiday_date === dateValue) ?? null
    hydrateHolidayForm(entry, dateValue)
    syncRangeFormDates(dateValue)
  }

  function selectDate(dateValue: string) {
    syncSelectedDate(dateValue)
    resetAlerts()
  }

  function shiftMonth(offset: number) {
    const next = new Date(currentYear.value, currentMonth.value - 1 + offset, 1)
    currentYear.value = next.getFullYear()
    currentMonth.value = next.getMonth() + 1
  }

  async function loadMonth(options: { clearAlerts?: boolean } = {}) {
    const clearAlerts = options.clearAlerts ?? true

    normalizeCurrentPeriod()
    loading.value = true
    if (clearAlerts) {
      resetAlerts()
    }

    try {
      allHolidays.value = await listHolidays({
        year: currentYear.value,
        month: currentMonth.value,
        include_inactive: true,
      })

      const nextSelectedDate = isIsoDateInMonth(selectedDate.value, currentYear.value, currentMonth.value)
        ? selectedDate.value
        : monthStartIso(currentYear.value, currentMonth.value)

      syncSelectedDate(nextSelectedDate)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Не удалось загрузить календарь'
    } finally {
      loading.value = false
    }
  }

  async function saveHoliday() {
    if (!canEdit.value) {
      return
    }

    const holidayDate = holidayForm.holiday_date.trim()
    const title = composeHolidayTitle(holidayForm.reason_type, holidayForm.comment)

    if (!isValidIsoDate(holidayDate)) {
      errorMessage.value = 'Укажите корректную дату в формате YYYY-MM-DD'
      return
    }

    if (!isIsoDateInMonth(holidayDate, currentYear.value, currentMonth.value)) {
      errorMessage.value = 'Дата должна относиться к выбранному месяцу календаря'
      return
    }

    loading.value = true
    resetAlerts()

    try {
      if (selectedHolidayId.value) {
        const updated = await updateHoliday(
          selectedHolidayId.value,
          {
            holiday_date: holidayDate,
            title: title || undefined,
            is_active: holidayForm.is_active,
          },
          auth.token,
        )
        await loadMonth({ clearAlerts: false })
        syncSelectedDate(updated.holiday_date)
        successMessage.value = `Дата обновлена: ${updated.holiday_date}`
        return
      }

      const created = await createHoliday(
        {
          holiday_date: holidayDate,
          title: title || undefined,
          is_active: holidayForm.is_active,
        },
        auth.token,
      )
      await loadMonth({ clearAlerts: false })
      syncSelectedDate(created.holiday_date)
      successMessage.value = `Дата добавлена: ${created.holiday_date}`
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Не удалось сохранить дату'
    } finally {
      loading.value = false
    }
  }

  async function removeHoliday(holidayId?: number | null) {
    const targetHolidayId = holidayId ?? selectedHolidayId.value
    if (!canEdit.value || !targetHolidayId) {
      return
    }

    loading.value = true
    resetAlerts()

    try {
      await deleteHoliday(targetHolidayId, auth.token)
      await loadMonth({ clearAlerts: false })
      successMessage.value = 'Дата удалена из календаря'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Не удалось удалить дату'
    } finally {
      loading.value = false
    }
  }

  async function saveHolidayRange() {
    if (!canEdit.value) {
      return
    }

    const startDate = rangeForm.start_date.trim()
    const endDate = rangeForm.end_date.trim()
    const title = composeHolidayTitle(rangeForm.reason_type, rangeForm.comment)

    if (!startDate || !endDate) {
      errorMessage.value = 'Нужно заполнить начало и конец диапазона'
      return
    }

    if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
      errorMessage.value = 'Укажите корректные даты диапазона в формате YYYY-MM-DD'
      return
    }

    if (endDate < startDate) {
      errorMessage.value = 'Дата окончания диапазона не может быть раньше даты начала'
      return
    }

    loading.value = true
    resetAlerts()

    try {
      const result = await createHolidayRange(
        {
          start_date: startDate,
          end_date: endDate,
          title: title || undefined,
          is_active: rangeForm.is_active,
        },
        auth.token,
      )

      await loadMonth({ clearAlerts: false })

      const firstVisibleCreated = result.created.find((entry) =>
        entry.holiday_date.startsWith(monthPrefix(currentYear.value, currentMonth.value)),
      )
      if (firstVisibleCreated) {
        syncSelectedDate(firstVisibleCreated.holiday_date)
      }

      successMessage.value = buildRangeSuccessMessage(result)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Не удалось создать диапазон дат'
    } finally {
      loading.value = false
    }
  }

  async function initialize() {
    try {
      await loadMonth({ clearAlerts: false })
    } finally {
      initialized.value = true
    }
  }

  watch([currentMonth, currentYear], () => {
    if (!initialized.value) {
      return
    }

    void loadMonth()
  })

  watch(includeInactive, () => {
    if (!initialized.value) {
      return
    }

    syncSelectedDate(selectedDate.value)
  })

  return {
    allHolidays,
    calendarCells,
    canEdit,
    currentMonth,
    currentYear,
    errorMessage,
    holidayForm,
    holidays,
    includeInactive,
    initialize,
    initialized,
    loading,
    rangeForm,
    removeHoliday,
    saveHoliday,
    saveHolidayRange,
    selectDate,
    selectedDate,
    selectedDateMeta,
    selectedHoliday,
    shiftMonth,
    successMessage,
    weekdayLabels,
  }
}
