<script setup lang="ts">
import { computed, defineAsyncComponent, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import StudentDetailHero from '@/components/students/StudentDetailHero.vue'
import StudentTicketInspector from '@/components/students/StudentTicketInspector.vue'
import StudentTicketsPanel from '@/components/students/StudentTicketsPanel.vue'
import TicketEndDateModal from '@/components/tickets/TicketEndDateModal.vue'
import { roleHome } from '@/config/navigation'
import { monthOptions } from '@/config/options'
import { getStudent, getStudentHistory, getStudentTickets, updateTicket } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import type { MealRecord, MealType, Student, Ticket, TicketStatus } from '@/types'
import { formatMealSummary } from '@/utils/meal'

const StudentMealHistoryPanel = defineAsyncComponent(() => import('@/components/students/StudentMealHistoryPanel.vue'))

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const student = ref<Student | null>(null)
const tickets = ref<Ticket[]>([])
const history = ref<MealRecord[]>([])
const loading = ref(true)
const historyLoading = ref(true)
const savingTicket = ref(false)
const ticketEndDateModalOpen = ref(false)
const ticketEndDateError = ref('')
const error = ref('')
const historyError = ref('')
const message = ref('')
const selectedTicketId = ref<string | null>(null)

const today = new Date()
const currentMonth = today.getMonth() + 1
const currentYear = today.getFullYear()

let primaryRequestId = 0
let historyRequestId = 0

const studentId = computed(() => String(route.params.id ?? ''))
const activeRole = computed(() => auth.effectiveRole ?? auth.userRole ?? 'social')
const selectedTicket = computed(() => tickets.value.find((ticket) => ticket.id === selectedTicketId.value) ?? null)
const activeTickets = computed(() => tickets.value.filter((ticket) => ticket.status === 'active'))
const canManageTickets = computed(() => ['social', 'head_social'].includes(activeRole.value))
const monthFilterOptions = computed(() => [{ label: 'Все месяцы', value: null }, ...monthOptions])

const yearFilterOptions = computed(() => {
  const startYear = currentYear - 2
  const endYear = currentYear + 2

  return [
    { label: 'Все годы', value: null },
    ...Array.from({ length: endYear - startYear + 1 }, (_, index) => {
      const value = startYear + index
      return { label: String(value), value }
    }),
  ]
})

function normalizeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }

  if (trimmed.startsWith('/students/') || trimmed.startsWith('/login')) {
    return null
  }

  return trimmed
}

const requestedReturnPath = computed(() => normalizeReturnPath(route.query.returnTo))
const returnPath = computed(() => {
  if (requestedReturnPath.value) {
    return requestedReturnPath.value
  }

  const role = activeRole.value
  if (role === 'cashier') return '/cashier'
  if (role === 'accountant') return '/accountant'
  if (role === 'social' || role === 'head_social') return '/social'
  return roleHome[role]
})

const returnLabel = computed(() => {
  const path = returnPath.value
  if (path.startsWith('/cashier')) return 'Назад в кассу'
  if (path.startsWith('/reports')) return 'Назад к отчетам'
  if (path.startsWith('/accountant')) return 'Назад к отчетам'
  if (path.startsWith('/admin')) return 'Назад в админку'
  if (path.startsWith('/dashboard')) return 'Назад к дашборду'
  return 'Назад к списку'
})

const historyFilter = reactive<{
  period_start: string
  period_end: string
  meal_type: MealType | 'all'
}>({
  period_start: '',
  period_end: '',
  meal_type: 'all',
})

const ticketFilter = reactive<{
  month: number | null
  year: number | null
  status: TicketStatus | 'all'
}>({
  month: currentMonth,
  year: currentYear,
  status: 'all',
})

function clearPrimaryError() {
  error.value = ''
}

function clearHistoryError() {
  historyError.value = ''
}

function prepareForStudentLoad() {
  message.value = ''
  clearPrimaryError()
  clearHistoryError()
  student.value = null
  tickets.value = []
  history.value = []
  selectedTicketId.value = null
  loading.value = true
  historyLoading.value = true
  historyRequestId += 1
}

function goBack() {
  void router.replace(returnPath.value)
}

function mealSummaryLabel() {
  if (!student.value) {
    return 'Студент не найден'
  }

  return formatMealSummary(student.value.category)
}

function mealBuildingLabel() {
  if (!student.value) {
    return '—'
  }

  if (student.value.allow_all_meal_buildings) {
    return 'Все корпуса'
  }

  return (
    student.value.effective_meal_building_name ||
    student.value.meal_building_name ||
    `Корпус ${student.value.effective_meal_building_id ?? student.value.building_id}`
  )
}

function resolveSelectedTicketId(ticketData: Ticket[], currentSelection: string | null): string | null {
  if (ticketData.length === 0) {
    return null
  }

  if (currentSelection && ticketData.some((ticket) => ticket.id === currentSelection)) {
    return currentSelection
  }

  return ticketData.find((ticket) => ticket.status === 'active')?.id ?? ticketData[0]?.id ?? null
}

function selectTicket(ticketId: string) {
  selectedTicketId.value = ticketId
}

async function loadPrimaryData() {
  const requestId = ++primaryRequestId
  loading.value = true
  clearPrimaryError()

  try {
    const [studentData, ticketData] = await Promise.all([
      getStudent(studentId.value),
      getStudentTickets(studentId.value, auth.token, {
        month: ticketFilter.month ?? undefined,
        year: ticketFilter.year ?? undefined,
        status: ticketFilter.status === 'all' ? undefined : ticketFilter.status,
      }),
    ])

    if (requestId !== primaryRequestId) {
      return null
    }

    student.value = studentData
    tickets.value = ticketData
    selectedTicketId.value = resolveSelectedTicketId(ticketData, selectedTicketId.value)

    if (!studentData) {
      error.value = 'Студент не найден.'
    }

    return studentData
  } catch (err) {
    if (requestId !== primaryRequestId) {
      return null
    }

    student.value = null
    tickets.value = []
    selectedTicketId.value = null
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить карточку студента.'
    return null
  } finally {
    if (requestId === primaryRequestId) {
      loading.value = false
    }
  }
}

async function loadHistoryData() {
  const requestId = ++historyRequestId
  historyLoading.value = true
  clearHistoryError()

  try {
    const historyData = await getStudentHistory(studentId.value, auth.token, {
      period_start: historyFilter.period_start || undefined,
      period_end: historyFilter.period_end || undefined,
      meal_type: historyFilter.meal_type === 'all' ? undefined : historyFilter.meal_type,
      limit: 200,
    })

    if (requestId !== historyRequestId) {
      return
    }

    history.value = historyData
  } catch (err) {
    if (requestId !== historyRequestId) {
      return
    }

    if (!history.value.length) {
      history.value = []
    }

    historyError.value = err instanceof Error ? err.message : 'Не удалось загрузить журнал питания.'
  } finally {
    if (requestId === historyRequestId) {
      historyLoading.value = false
    }
  }
}

async function loadStudentPage() {
  const studentData = await loadPrimaryData()

  if (!studentData) {
    history.value = []
    historyLoading.value = false
    return
  }

  void loadHistoryData()
}

function resetTicketFilters() {
  ticketFilter.month = currentMonth
  ticketFilter.year = currentYear
  ticketFilter.status = 'all'
  void loadPrimaryData()
}

function resetHistoryFilters() {
  historyFilter.period_start = ''
  historyFilter.period_end = ''
  historyFilter.meal_type = 'all'
  void loadHistoryData()
}

async function cancelTicket(ticket: Ticket) {
  if (!canManageTickets.value) {
    return
  }

  if (ticket.status !== 'active') {
    message.value = 'Отмена доступна только для активного талона.'
    return
  }

  if (ticket.is_locked) {
    message.value = 'Нельзя отменить талон, по которому уже есть выдачи питания. Измените дату окончания талона.'
    return
  }

  savingTicket.value = true
  message.value = ''
  clearPrimaryError()

  try {
    await updateTicket(ticket.id, { status: 'cancelled' }, auth.token)
    message.value = 'Талон отменён.'
    await loadPrimaryData()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось отменить талон.'
  } finally {
    savingTicket.value = false
  }
}

function openTicketEndDateModal(ticket: Ticket) {
  if (!canManageTickets.value) {
    return
  }

  ticketEndDateError.value = ''
  message.value = ''
  clearPrimaryError()
  selectedTicketId.value = ticket.id
  ticketEndDateModalOpen.value = true
}

function closeTicketEndDateModal(force = false) {
  if (savingTicket.value && !force) {
    return
  }

  ticketEndDateModalOpen.value = false
  ticketEndDateError.value = ''
}

async function submitTicketEndDate(endDate: string) {
  const ticket = selectedTicket.value
  if (!ticket || !canManageTickets.value) {
    return
  }

  savingTicket.value = true
  ticketEndDateError.value = ''
  message.value = ''
  clearPrimaryError()

  try {
    await updateTicket(ticket.id, { end_date: endDate }, auth.token)
    await loadPrimaryData()
    closeTicketEndDateModal(true)
    message.value = 'Срок действия талона обновлен.'
  } catch (err) {
    ticketEndDateError.value = err instanceof Error ? err.message : 'Не удалось обновить срок действия талона.'
  } finally {
    savingTicket.value = false
  }
}

watch(
  () => route.params.id,
  () => {
    prepareForStudentLoad()
    void loadStudentPage()
  },
  { immediate: true },
)
</script>

<template>
  <section class="page-stack student-detail-page">
    <p v-if="message" class="success-banner">{{ message }}</p>
    <p v-if="error && !loading" class="error-banner">{{ error }}</p>

    <div v-if="loading && !student" class="muted-block">Загружаем карточку студента...</div>

    <template v-else-if="student">
      <StudentDetailHero
        :student="student"
        :meal-building-label="mealBuildingLabel()"
        :meal-summary="mealSummaryLabel()"
        :active-tickets-count="activeTickets.length"
        :return-label="returnLabel"
        @back="goBack"
      />

      <div class="student-detail-topline">
        <StudentTicketsPanel
          :tickets="tickets"
          :selected-ticket-id="selectedTicketId"
          :ticket-filter="ticketFilter"
          :month-filter-options="monthFilterOptions"
          :year-filter-options="yearFilterOptions"
          @select="selectTicket"
          @refresh="loadPrimaryData"
          @reset="resetTicketFilters"
        />

        <aside class="student-detail-sidebar">
          <StudentTicketInspector
            :ticket="selectedTicket"
            :can-manage-tickets="canManageTickets"
            :saving="savingTicket"
            @cancel="cancelTicket"
            @change-end-date="openTicketEndDateModal"
          />
        </aside>
      </div>

      <StudentMealHistoryPanel
        :history="history"
        :history-filter="historyFilter"
        :loading="historyLoading"
        :error="historyError"
        @refresh="loadHistoryData"
        @reset="resetHistoryFilters"
      />

      <TicketEndDateModal
        :visible="ticketEndDateModalOpen"
        :ticket="selectedTicket"
        :loading="savingTicket"
        :error-message="ticketEndDateError"
        @close="closeTicketEndDateModal"
        @submit="submitTicketEndDate"
      />
    </template>

    <div v-else class="student-detail-empty">
      <p>Карточка студента недоступна.</p>
      <p-button :label="returnLabel" severity="secondary" outlined @click="goBack" />
    </div>
  </section>
</template>

<style scoped>
.student-detail-page {
  --student-detail-space-1: 8px;
  --student-detail-space-2: 12px;
  --student-detail-space-3: 16px;
  --student-detail-space-4: 20px;
  --student-detail-space-5: 24px;
  --student-detail-space-6: 28px;
  gap: var(--student-detail-space-5);
}

.student-detail-topline {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(340px, 0.82fr);
  gap: var(--student-detail-space-4);
  align-items: start;
}

.student-detail-sidebar {
  position: sticky;
  top: var(--student-detail-space-4);
}

.student-detail-empty {
  display: flex;
  flex-direction: column;
  gap: var(--student-detail-space-2, 12px);
  align-items: flex-start;
  padding: var(--student-detail-space-4, 20px);
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.8);
  color: var(--muted);
}

@media (max-width: 1120px) {
  .student-detail-topline {
    grid-template-columns: 1fr;
  }

  .student-detail-sidebar {
    position: static;
  }
}
</style>
