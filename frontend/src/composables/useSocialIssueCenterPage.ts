import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  getCategories,
  getMealSheetDocument,
  getTicketPrintSheetDocument,
  getTicketReceiptSheetDocument,
  listHolidays,
  listTickets,
  searchStudents,
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { Category, HolidayEntry, Student, Ticket, TicketStatus } from '@/types'
import { saveBlob } from '@/utils/files'
import { printDocument } from '@/utils/printDocument'
import {
  buildIssueSummaryWorkbook,
  buildStudentListDocument,
  buildStudentsWorkbook,
} from '@/utils/socialIssueDocuments'
import { formatMonthLabel, getMonthPeriod } from '@/utils/socialPedagogMonth'

type IssuePeriodOption = {
  label: string
  value: string
  month: number
  year: number
}

function buildIssuePeriodOptions(selectedYear: number): IssuePeriodOption[] {
  const currentYear = new Date().getFullYear()
  const startYear = Math.min(currentYear - 1, selectedYear - 1)
  const endYear = Math.max(currentYear + 1, selectedYear + 1)
  const options: IssuePeriodOption[] = []

  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      options.push({
        month,
        year,
        value: `${year}-${String(month).padStart(2, '0')}`,
        label: formatMonthLabel(year, month).replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
      })
    }
  }

  return options
}

export function useSocialIssueCenterPage() {
  const auth = useAuthStore()

  const today = new Date()
  const month = ref(today.getMonth() + 1)
  const year = ref(today.getFullYear())
  const selectedCategoryId = ref<number | null>(null)
  const categories = ref<Category[]>([])
  const students = ref<Student[]>([])
  const tickets = ref<Ticket[]>([])
  const holidays = ref<HolidayEntry[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const successMessage = ref('')
  const errorMessage = ref('')

  const buildingId = computed(() => (auth.effectiveRole === 'social' ? auth.userBuilding ?? undefined : undefined))
  const buildingLabel = computed(() => auth.user?.building_name || 'Все корпуса')
  const activeTickets = computed(() => tickets.value.filter((ticket) => ticket.status === 'active'))
  const currentMonthLabel = computed(() => formatMonthLabel(year.value, month.value).replace(/^\p{L}/u, (letter) => letter.toUpperCase()))
  const selectedCategoryLabel = computed(
    () => categories.value.find((category) => category.id === selectedCategoryId.value)?.name ?? 'Все категории',
  )
  const period = computed(() => getMonthPeriod(year.value, month.value))
  const workdayCount = computed(() => {
    const holidaySet = new Set(holidays.value.filter((entry) => entry.is_active).map((entry) => entry.holiday_date))
    const totalDays = new Date(year.value, month.value, 0).getDate()
    let count = 0

    for (let day = 1; day <= totalDays; day += 1) {
      const current = new Date(year.value, month.value - 1, day)
      const iso = `${year.value}-${String(month.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (current.getDay() === 0 || holidaySet.has(iso)) {
        continue
      }
      count += 1
    }

    return count
  })
  const holidayCount = computed(() => holidays.value.filter((entry) => entry.is_active).length)
  const mealDayCount = computed(() => workdayCount.value)
  const studentsCount = computed(() => students.value.length)
  const periodOptions = computed(() => buildIssuePeriodOptions(year.value))
  const periodKey = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}`)

  function resetAlerts() {
    errorMessage.value = ''
    successMessage.value = ''
  }

  async function loadCategories() {
    categories.value = await getCategories()
  }

  async function loadStudents() {
    students.value = await searchStudents({
      building_id: buildingId.value,
      category_id: selectedCategoryId.value ?? undefined,
      status: 'active',
    })
  }

  async function loadTickets() {
    tickets.value = await listTickets({
      building_id: buildingId.value,
      month: month.value,
      year: year.value,
      category_id: selectedCategoryId.value ?? undefined,
      status: 'active',
    })
  }

  async function loadHolidays() {
    holidays.value = await listHolidays({
      year: year.value,
      month: month.value,
      include_inactive: false,
    })
  }

  async function refreshPeriodData() {
    loading.value = true
    resetAlerts()
    try {
      await Promise.all([loadStudents(), loadTickets(), loadHolidays()])
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось загрузить данные раздела'
    } finally {
      loading.value = false
    }
  }

  async function loadPage() {
    loading.value = true
    resetAlerts()
    try {
      await Promise.all([loadCategories(), loadStudents(), loadTickets(), loadHolidays()])
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось загрузить данные раздела'
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  function setPeriodKey(nextValue: string) {
    const matched = periodOptions.value.find((option) => option.value === nextValue)
    if (!matched) {
      return
    }

    month.value = matched.month
    year.value = matched.year
  }

  function setCurrentPeriod() {
    const current = new Date()
    month.value = current.getMonth() + 1
    year.value = current.getFullYear()
  }

  function buildFilePeriodSuffix() {
    return `${year.value}-${String(month.value).padStart(2, '0')}`
  }

  async function printTicketSheet() {
    resetAlerts()
    try {
      const document = await getTicketPrintSheetDocument(month.value, year.value, auth.token, {
        building_id: buildingId.value,
        category_id: selectedCategoryId.value ?? undefined,
        print_size: 'large',
      })
      if (!printDocument(document)) {
        throw new Error('Не удалось открыть окно печати')
      }
      successMessage.value = 'Лист талонов открыт'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось сформировать лист талонов'
    }
  }

  function printStudentList() {
    resetAlerts()
    try {
      const document = buildStudentListDocument({
        monthLabel: currentMonthLabel.value,
        buildingLabel: buildingLabel.value,
        categoryLabel: selectedCategoryLabel.value,
        students: students.value,
      })
      if (!printDocument(document)) {
        throw new Error('Не удалось открыть окно печати')
      }
      successMessage.value = 'Список студентов открыт'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось сформировать список студентов'
    }
  }

  function downloadStudentsWorkbook() {
    resetAlerts()
    try {
      const blob = buildStudentsWorkbook({
        monthLabel: currentMonthLabel.value,
        buildingLabel: buildingLabel.value,
        categoryLabel: selectedCategoryLabel.value,
        students: students.value,
      })
      saveBlob(blob, `students-${buildFilePeriodSuffix()}.xls`)
      successMessage.value = 'Список студентов выгружен'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось сформировать файл'
    }
  }

  async function printReceiptSheet() {
    resetAlerts()
    try {
      const document = await getTicketReceiptSheetDocument(month.value, year.value, auth.token, {
        building_id: buildingId.value,
        category_id: selectedCategoryId.value ?? undefined,
      })
      if (!printDocument(document)) {
        throw new Error('Не удалось открыть окно печати')
      }
      successMessage.value = 'Ведомость получения открыта'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось сформировать ведомость получения'
    }
  }

  async function printSummarySheet() {
    resetAlerts()
    try {
      const document = await getMealSheetDocument(period.value.startDate, period.value.endDate, auth.token, {
        building_id: buildingId.value,
        category_id: selectedCategoryId.value ?? undefined,
        status: 'active' as TicketStatus,
      })
      if (!printDocument(document)) {
        throw new Error('Не удалось открыть окно печати')
      }
      successMessage.value = 'Итоговая ведомость открыта'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось сформировать итоговую ведомость'
    }
  }

  async function downloadSummaryWorkbook() {
    resetAlerts()
    try {
      const document = await getMealSheetDocument(period.value.startDate, period.value.endDate, auth.token, {
        building_id: buildingId.value,
        category_id: selectedCategoryId.value ?? undefined,
        status: 'active' as TicketStatus,
      })
      const blob = buildIssueSummaryWorkbook(document)
      saveBlob(blob, `meal-summary-${buildFilePeriodSuffix()}.xls`)
      successMessage.value = 'Итоговая ведомость выгружена'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Не удалось сформировать файл'
    }
  }

  watch([month, year, selectedCategoryId], () => {
    if (!initialized.value) {
      return
    }

    void refreshPeriodData()
  })

  onMounted(loadPage)

  return reactive({
    month,
    year,
    selectedCategoryId,
    categories,
    students,
    tickets,
    holidays,
    loading,
    initialized,
    successMessage,
    errorMessage,
    buildingLabel,
    activeTickets,
    currentMonthLabel,
    selectedCategoryLabel,
    workdayCount,
    holidayCount,
    mealDayCount,
    studentsCount,
    periodOptions,
    periodKey,
    loadPage,
    refreshPeriodData,
    setPeriodKey,
    setCurrentPeriod,
    printTicketSheet,
    printStudentList,
    downloadStudentsWorkbook,
    printReceiptSheet,
    printSummarySheet,
    downloadSummaryWorkbook,
  })
}
