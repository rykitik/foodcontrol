import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSocialBulkTicketSelection } from '@/composables/useSocialBulkTicketSelection'
import { useTicketPeriod } from '@/composables/useTicketPeriod'
import {
  createStudent,
  createBulkTickets,
  createTicket,
  getCategories,
  getTicketDocument,
  listStudentGroups,
  listStudentsPage,
  listTickets,
  previewBulkTickets,
  reissueTicket,
  updateStudent,
  updateTicket,
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type {
  Category,
  PaginatedResult,
  Student,
  StudentCreateRequest,
  StudentStatusFilter,
  StudentUpdateRequest,
  Ticket,
  TicketBulkPreviewResponse,
} from '@/types'
import { printDocument } from '@/utils/printDocument'
import { formatMonthLabel } from '@/utils/socialPedagogMonth'
import { mergeStudentGroupName } from '@/utils/studentGroups'
import { studentCodeLabel } from '@/utils/studentPresentation'
import { DEFAULT_TICKET_PRINT_PRESET } from '@/utils/ticketPrintPresets'

export function useSocialStudentsPage() {
  const auth = useAuthStore()
  const router = useRouter()
  const route = useRoute()

  const today = new Date()
  const search = ref('')
  const categoryId = ref<number | null>(null)
  const studentStatusFilter = ref<StudentStatusFilter>('active')
  const month = ref(today.getMonth() + 1)
  const year = ref(today.getFullYear())
  const studentsPage = ref<PaginatedResult<Student> | null>(null)
  const tickets = ref<Ticket[]>([])
  const categories = ref<Category[]>([])
  const studentGroupSuggestions = ref<string[]>([])
  const loading = ref(false)
  const busyStudentId = ref<string | null>(null)
  const busyTicketId = ref<string | null>(null)
  const printingTicketId = ref<string | null>(null)
  const busyMealBuildingStudentId = ref<string | null>(null)
  const bulkIssueSubmitting = ref(false)
  const bulkPreviewLoading = ref(false)
  const bulkIssuePanelOpen = ref(false)
  const bulkPreview = ref<TicketBulkPreviewResponse | null>(null)
  const bulkPreviewError = ref('')
  const studentCreateModalOpen = ref(false)
  const studentCreateSubmitting = ref(false)
  const studentCreateResetKey = ref(0)
  const studentCreateError = ref('')
  const ticketEndDateModalOpen = ref(false)
  const ticketEndDateSubmitting = ref(false)
  const ticketEndDateError = ref('')
  const ticketEndDateTarget = ref<Ticket | null>(null)
  const errorMessage = ref('')
  const successMessage = ref('')
  const studentPage = ref(1)
  const studentPageSize = ref(25)

  let bulkPreviewRequestId = 0

  const activeRole = computed(() => auth.effectiveRole ?? auth.userRole ?? 'social')
  const buildingId = computed(() => (activeRole.value === 'social' ? auth.userBuilding ?? undefined : undefined))
  const manageableBuildingId = computed(() => auth.userBuilding ?? null)
  const buildingLabel = computed(() => auth.user?.building_name || 'Все корпуса')
  const studentCreateBuildingId = computed(() => auth.userBuilding ?? 1)
  const studentCreateBuildingLabel = computed(() => auth.user?.building_name || `Корпус ${studentCreateBuildingId.value}`)
  const studentCreateLockBuilding = computed(() => activeRole.value === 'social' && auth.userBuilding !== null)
  const studentCreateGroupBuildingId = computed(() => (studentCreateLockBuilding.value ? studentCreateBuildingId.value : undefined))
  const managementDisabledReason = 'Соцпедагог может управлять только студентами своего корпуса'
  const issueDisabledReason = computed(() => 'Выдача талонов за прошедшие месяцы недоступна')
  const selectedMonthLabel = computed(() => formatMonthLabel(year.value, month.value))
  const pageContextLabel = computed(() => {
    if (activeRole.value === 'social') {
      return `Корпус педагога: ${buildingLabel.value}`
    }

    return 'Списки по корпусам, назначение корпуса питания и выпуск по студентам.'
  })
  const canIssueTickets = computed(() => {
    const current = new Date()
    const selected = new Date(year.value, month.value - 1, 1)
    const currentMonthStart = new Date(current.getFullYear(), current.getMonth(), 1)
    return selected >= currentMonthStart
  })

  const students = computed(() => studentsPage.value?.items ?? [])
  const studentTotal = computed(() => studentsPage.value?.total ?? 0)

  function isBulkSelectableStudent(student: Student): boolean {
    return Boolean(student.is_active && (manageableBuildingId.value == null || student.building_id === manageableBuildingId.value))
  }

  const {
    allVisibleSelected,
    clearSelection,
    hasSelection,
    selectedCount,
    selectedStudentIds,
    toggleAllVisible,
    toggleStudent,
  } = useSocialBulkTicketSelection({
    students,
    isSelectable: isBulkSelectableStudent,
  })

  const ticketPeriod = useTicketPeriod({ month, year })

  function resetAlerts() {
    errorMessage.value = ''
    successMessage.value = ''
  }

  function resetBulkPreviewState() {
    bulkPreviewRequestId += 1
    bulkPreview.value = null
    bulkPreviewLoading.value = false
    bulkPreviewError.value = ''
  }

  async function loadCategories() {
    categories.value = await getCategories()
  }

  async function loadStudentGroupSuggestions() {
    studentGroupSuggestions.value = await listStudentGroups({ building_id: studentCreateGroupBuildingId.value })
  }

  async function loadStudents() {
    studentsPage.value = await listStudentsPage({
      q: search.value || undefined,
      building_id: buildingId.value,
      category_id: categoryId.value ?? undefined,
      status: studentStatusFilter.value === 'all' ? undefined : studentStatusFilter.value,
      page: studentPage.value,
      page_size: studentPageSize.value,
    })
  }

  async function loadTickets() {
    tickets.value = await listTickets({
      building_id: buildingId.value,
      category_id: categoryId.value ?? undefined,
      month: month.value,
      year: year.value,
    })
  }

  async function loadPage() {
    loading.value = true
    resetAlerts()
    try {
      await Promise.all([loadCategories(), loadStudentGroupSuggestions(), loadStudents(), loadTickets()])
    } finally {
      loading.value = false
    }
  }

  async function issue(student: Student) {
    if (!canIssueTickets.value) {
      resetAlerts()
      errorMessage.value = issueDisabledReason.value
      return
    }

    busyStudentId.value = student.id
    resetAlerts()
    try {
      await createTicket({ student_id: student.id, month: month.value, year: year.value }, auth.token)
      successMessage.value = 'Талон выдан'
      await loadTickets()
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Ошибка выдачи талона'
    } finally {
      busyStudentId.value = null
    }
  }

  async function cancel(ticket: Ticket) {
    busyTicketId.value = ticket.id
    resetAlerts()
    try {
      await updateTicket(ticket.id, { status: 'cancelled' }, auth.token)
      successMessage.value = 'Талон отменен'
      await loadTickets()
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Ошибка отмены талона'
    } finally {
      busyTicketId.value = null
    }
  }

  function openTicketEndDateModal(ticket: Ticket) {
    resetAlerts()
    ticketEndDateError.value = ''
    ticketEndDateTarget.value = ticket
    ticketEndDateModalOpen.value = true
  }

  function closeTicketEndDateModal(force = false) {
    if (ticketEndDateSubmitting.value && !force) {
      return
    }

    ticketEndDateModalOpen.value = false
    ticketEndDateError.value = ''
    ticketEndDateTarget.value = null
  }

  async function submitTicketEndDate(endDate: string) {
    const ticket = ticketEndDateTarget.value
    if (!ticket) {
      return
    }

    ticketEndDateSubmitting.value = true
    busyTicketId.value = ticket.id
    ticketEndDateError.value = ''
    resetAlerts()

    try {
      await updateTicket(ticket.id, { end_date: endDate }, auth.token)
      await loadTickets()
      closeTicketEndDateModal(true)
      successMessage.value = 'Срок действия талона обновлен'
    } catch (err) {
      ticketEndDateError.value = err instanceof Error ? err.message : 'Не удалось обновить срок действия талона'
    } finally {
      ticketEndDateSubmitting.value = false
      busyTicketId.value = null
    }
  }

  async function reissue(ticket: Ticket) {
    busyTicketId.value = ticket.id
    resetAlerts()
    try {
      await reissueTicket(ticket.id, auth.token)
      successMessage.value = 'Талон перевыпущен'
      await loadTickets()
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Ошибка перевыпуска'
    } finally {
      busyTicketId.value = null
    }
  }

  async function print(ticket: Ticket) {
    printingTicketId.value = ticket.id
    resetAlerts()
    try {
      const doc = await getTicketDocument(ticket.id, auth.token, { print_size: DEFAULT_TICKET_PRINT_PRESET })
      if (!printDocument(doc)) {
        throw new Error('Окно печати заблокировано')
      }
      successMessage.value = 'Печать открыта'
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Ошибка печати'
    } finally {
      printingTicketId.value = null
    }
  }

  async function toggleStudentActive(student: Student) {
    busyStudentId.value = student.id
    resetAlerts()
    try {
      await updateStudent(student.id, { is_active: !student.is_active }, auth.token)
      successMessage.value = student.is_active ? 'Студент отключен' : 'Студент включен'
      await loadStudents()
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Ошибка обновления статуса студента'
    } finally {
      busyStudentId.value = null
    }
  }

  async function saveMealBuilding(
    student: Student,
    request: Pick<StudentUpdateRequest, 'meal_building_id' | 'allow_all_meal_buildings'>,
  ) {
    busyMealBuildingStudentId.value = student.id
    resetAlerts()

    try {
      await updateStudent(student.id, request, auth.token)
      successMessage.value = 'Корпус питания обновлен'
      await Promise.all([loadStudents(), loadTickets()])
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Ошибка обновления корпуса питания'
    } finally {
      busyMealBuildingStudentId.value = null
    }
  }

  function open(studentId: string) {
    void router.push({
      path: `/students/${studentId}`,
      query: { returnTo: route.fullPath },
    })
  }

  function openCreateStudent() {
    resetAlerts()
    studentCreateError.value = ''
    studentCreateModalOpen.value = true
  }

  function closeCreateStudentModal() {
    if (studentCreateSubmitting.value) {
      return
    }

    studentCreateModalOpen.value = false
    studentCreateError.value = ''
    studentCreateResetKey.value += 1
  }

  async function submitStudent(payload: StudentCreateRequest) {
    studentCreateSubmitting.value = true
    studentCreateError.value = ''
    resetAlerts()

    try {
      const student = await createStudent(payload, auth.token)
      studentGroupSuggestions.value = mergeStudentGroupName(studentGroupSuggestions.value, student.group_name)
      await loadStudents()
      studentCreateModalOpen.value = false
      studentCreateResetKey.value += 1
      successMessage.value = `Студент добавлен. ${studentCodeLabel}: ${student.student_card}`
    } catch (err) {
      studentCreateError.value = err instanceof Error ? err.message : 'Не удалось добавить студента'
    } finally {
      studentCreateSubmitting.value = false
    }
  }

  function changeStudentPage(nextPage: number) {
    const total = studentsPage.value?.total ?? 0
    const maxPage = Math.max(1, Math.ceil(total / studentPageSize.value))
    studentPage.value = Math.min(Math.max(nextPage, 1), maxPage)
    void loadStudents()
  }

  function submitStudentSearch() {
    studentPage.value = 1
    void loadStudents()
  }

  function openBulkIssuePanel() {
    if (!selectedStudentIds.value.length) {
      return
    }

    bulkIssuePanelOpen.value = true
  }

  function closeBulkIssuePanel(force = false) {
    if (bulkIssueSubmitting.value && !force) {
      return
    }

    bulkIssuePanelOpen.value = false
    resetBulkPreviewState()
  }

  async function refreshBulkPreview() {
    if (!bulkIssuePanelOpen.value || !selectedStudentIds.value.length) {
      resetBulkPreviewState()
      return
    }

    if (ticketPeriod.validationMessage.value) {
      resetBulkPreviewState()
      return
    }

    const requestId = ++bulkPreviewRequestId
    bulkPreviewLoading.value = true
    bulkPreviewError.value = ''

    try {
      const preview = await previewBulkTickets(
        {
          student_ids: selectedStudentIds.value,
          start_date: ticketPeriod.requestPeriod.value.start_date,
          end_date: ticketPeriod.requestPeriod.value.end_date,
          only_active: true,
        },
        auth.token,
      )
      if (requestId !== bulkPreviewRequestId) {
        return
      }
      bulkPreview.value = preview
    } catch (err) {
      if (requestId !== bulkPreviewRequestId) {
        return
      }
      bulkPreview.value = null
      bulkPreviewError.value = err instanceof Error ? err.message : 'Не удалось подготовить предпросмотр'
    } finally {
      if (requestId === bulkPreviewRequestId) {
        bulkPreviewLoading.value = false
      }
    }
  }

  async function issueSelectedStudents() {
    if (!selectedStudentIds.value.length) {
      return
    }

    if (ticketPeriod.validationMessage.value) {
      bulkPreviewError.value = ticketPeriod.validationMessage.value
      return
    }

    bulkIssueSubmitting.value = true
    resetAlerts()
    try {
      const result = await createBulkTickets(
        {
          student_ids: selectedStudentIds.value,
          start_date: ticketPeriod.requestPeriod.value.start_date,
          end_date: ticketPeriod.requestPeriod.value.end_date,
          only_active: true,
        },
        auth.token,
      )

      await Promise.all([loadStudents(), loadTickets()])
      closeBulkIssuePanel(true)
      clearSelection()
      ticketPeriod.reset()

      if (result.created_count > 0) {
        const skippedLabel = result.skipped_count ? `, пропущено: ${result.skipped_count}` : ''
        successMessage.value = `Выдано ${result.created_count} талонов для ${result.created_student_count} студентов${skippedLabel}`
        return
      }

      const firstReason = result.skipped_students[0]?.reason
      errorMessage.value = firstReason ? `Выдача не выполнена: ${firstReason}` : 'Выдача не выполнена'
    } catch (err) {
      bulkPreviewError.value = err instanceof Error ? err.message : 'Ошибка пакетной выдачи талонов'
    } finally {
      bulkIssueSubmitting.value = false
    }
  }

  watch([month, year], async () => {
    await loadTickets()
  })

  watch(categoryId, async () => {
    studentPage.value = 1
    await Promise.all([loadTickets(), loadStudents()])
  })

  watch(studentStatusFilter, async () => {
    studentPage.value = 1
    await loadStudents()
  })

  watch(
    () => [
      bulkIssuePanelOpen.value,
      selectedStudentIds.value.join(','),
      ticketPeriod.periodType.value,
      ticketPeriod.startDate.value,
      ticketPeriod.endDate.value,
    ],
    () => {
      void refreshBulkPreview()
    },
  )

  watch(hasSelection, (nextHasSelection) => {
    if (nextHasSelection) {
      return
    }
    closeBulkIssuePanel()
  })

  onMounted(loadPage)

  return reactive({
    search,
    categoryId,
    studentStatusFilter,
    month,
    year,
    categories,
    studentGroupSuggestions,
    loading,
    students,
    tickets,
    studentTotal,
    busyStudentId,
    busyTicketId,
    printingTicketId,
    busyMealBuildingStudentId,
    bulkIssueSubmitting,
    bulkIssuePanelOpen,
    bulkPreview,
    bulkPreviewLoading,
    bulkPreviewError,
    studentCreateModalOpen,
    studentCreateSubmitting,
    studentCreateResetKey,
    studentCreateError,
    ticketEndDateModalOpen,
    ticketEndDateSubmitting,
    ticketEndDateError,
    ticketEndDateTarget,
    errorMessage,
    successMessage,
    studentPage,
    studentPageSize,
    manageableBuildingId,
    studentCreateBuildingId,
    studentCreateBuildingLabel,
    studentCreateLockBuilding,
    managementDisabledReason,
    issueDisabledReason,
    selectedMonthLabel,
    pageContextLabel,
    canIssueTickets,
    allVisibleSelected,
    clearSelection,
    hasSelection,
    selectedCount,
    selectedStudentIds,
    toggleAllVisible,
    toggleStudent,
    ticketPeriod,
    loadPage,
    issue,
    cancel,
    closeTicketEndDateModal,
    openTicketEndDateModal,
    reissue,
    print,
    submitTicketEndDate,
    toggleStudentActive,
    saveMealBuilding,
    open,
    openCreateStudent,
    closeCreateStudentModal,
    submitStudent,
    changeStudentPage,
    submitStudentSearch,
    openBulkIssuePanel,
    closeBulkIssuePanel,
    issueSelectedStudents,
  })
}
