<script setup lang="ts">
import type { CSSProperties } from 'vue'

import SocialMealBuildingSelect from '@/components/social/SocialMealBuildingSelect.vue'
import SocialStudentTicketActions from '@/components/social/SocialStudentTicketActions.vue'
import TicketStatusChip from '@/components/tickets/TicketStatusChip.vue'
import { formatMealSummary } from '@/utils/meal'
import { formatStudentCode, studentCodeShortLabel } from '@/utils/studentPresentation'
import type { Student, StudentUpdateRequest, Ticket, TicketStatus } from '@/types'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const props = defineProps<{
  students: Student[]
  tickets: Ticket[]
  loading?: boolean
  busyStudentId?: string | null
  busyTicketId?: string | null
  printingTicketId?: string | null
  busyMealBuildingStudentId?: string | null
  manageableBuildingId?: number | null
  managementDisabledReason?: string
  canIssueTickets?: boolean
  issueDisabledReason?: string
  selectedStudentIds?: string[]
  allVisibleSelected?: boolean
}>()

const emit = defineEmits<{
  issue: [student: Student]
  open: [studentId: string]
  cancel: [ticket: Ticket]
  changeEndDate: [ticket: Ticket]
  reissue: [ticket: Ticket]
  print: [ticket: Ticket]
  toggleActive: [student: Student]
  toggleSelect: [student: Student, checked: boolean]
  toggleSelectAll: [checked: boolean]
  updateMealBuilding: [student: Student, request: Pick<StudentUpdateRequest, 'meal_building_id' | 'allow_all_meal_buildings'>]
}>()

function currentTicket(studentId: string): Ticket | null {
  return props.tickets.find((ticket) => ticket.student_id === studentId) ?? null
}

function activeTicket(studentId: string): Ticket | null {
  return props.tickets.find((ticket) => ticket.student_id === studentId && ticket.status === 'active') ?? null
}

function ticketStatus(studentId: string): TicketStatus | null {
  return currentTicket(studentId)?.status ?? null
}

function toDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function ticketPeriodLabel(studentId: string): string {
  const ticket = currentTicket(studentId)
  if (!ticket) {
    return '—'
  }

  return `${dateFormatter.format(toDate(ticket.start_date))} — ${dateFormatter.format(toDate(ticket.end_date))}`
}

function isManageableStudent(student: Student): boolean {
  return props.manageableBuildingId == null || student.building_id === props.manageableBuildingId
}

function managementReason(student: Student): string | undefined {
  return isManageableStudent(student) ? undefined : props.managementDisabledReason
}

function isSelectableStudent(student: Student): boolean {
  return student.is_active && isManageableStudent(student)
}

function selectionReason(student: Student): string | undefined {
  if (!student.is_active) {
    return 'Сначала включите студента'
  }

  return managementReason(student)
}

function isSelected(studentId: string): boolean {
  return props.selectedStudentIds?.includes(studentId) ?? false
}

function hasAttentionState(student: Student): boolean {
  return !student.is_active || Boolean(currentTicket(student.id)?.requires_attention)
}

function categoryBadgeStyle(student: Student): CSSProperties | undefined {
  const color = student.category.color
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) {
    return undefined
  }

  return {
    color,
    backgroundColor: `${color}18`,
    borderColor: `${color}2e`,
  }
}

function mealLines(student: Student): string[] {
  return formatMealSummary(student.category).split(' · ')
}
</script>

<template>
  <div class="students-table">
    <table>
      <thead>
        <tr>
          <th class="select-col">
            <input
              type="checkbox"
              :checked="allVisibleSelected"
              :disabled="!students.some((student) => isSelectableStudent(student))"
              aria-label="Выбрать студентов на текущей странице"
              @change="emit('toggleSelectAll', ($event.target as HTMLInputElement).checked)"
            />
          </th>
          <th>ФИО</th>
          <th>Группа</th>
          <th>Категория</th>
          <th>Корпус студента</th>
          <th class="meal-building-col">
            <span class="header-inline">
              <span>Корпус питания</span>
              <span
                class="info-badge"
                title="Здесь можно быстро выбрать корпус питания для студента"
                aria-label="Подсказка по корпусу питания"
              >
                i
              </span>
            </span>
          </th>
          <th>Питание</th>
          <th>Статус талона</th>
          <th>Период талона</th>
          <th class="actions-col">Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!students.length">
          <td colspan="10" class="empty">
            {{ loading ? 'Загружаем список студентов...' : 'Студенты не найдены' }}
          </td>
        </tr>
        <tr
          v-for="student in students"
          :key="student.id"
          :class="[
            'student-row',
            {
              'student-row--selected': isSelected(student.id),
              'student-row--attention': hasAttentionState(student),
              'student-row--inactive': !student.is_active,
              'student-row--restricted': !isManageableStudent(student),
            },
          ]"
        >
          <td class="select-col" :title="selectionReason(student)">
            <input
              type="checkbox"
              :checked="isSelected(student.id)"
              :disabled="!isSelectableStudent(student)"
              :aria-label="`Выбрать ${student.full_name}`"
              @change="emit('toggleSelect', student, ($event.target as HTMLInputElement).checked)"
            />
          </td>
          <td>
            <div class="student-main">
              <strong>{{ student.full_name }}</strong>
              <small>{{ studentCodeShortLabel }}: {{ formatStudentCode(student.student_card) }}</small>
            </div>
          </td>
          <td>{{ student.group_name }}</td>
          <td>
            <span class="category-chip" :style="categoryBadgeStyle(student)">{{ student.category.name }}</span>
          </td>
          <td>
            <div class="building-copy">
              <span>{{ student.building_name || `Корпус ${student.building_id}` }}</span>
            </div>
          </td>
          <td class="meal-building-cell">
            <SocialMealBuildingSelect
              :student="student"
              :busy="busyMealBuildingStudentId === student.id"
              :disabled="!isManageableStudent(student)"
              :disabled-reason="managementReason(student)"
              @save="emit('updateMealBuilding', student, $event)"
            />
          </td>
          <td>
            <div class="meal-copy">
              <span v-for="line in mealLines(student)" :key="line">{{ line }}</span>
            </div>
          </td>
          <td>
            <TicketStatusChip v-if="ticketStatus(student.id)" :status="ticketStatus(student.id)!" />
            <span v-else class="muted-text">Нет талона</span>
          </td>
          <td class="ticket-period">{{ ticketPeriodLabel(student.id) }}</td>
          <td class="actions-col" :title="managementReason(student)">
            <SocialStudentTicketActions
              :student="student"
              :active-ticket="activeTicket(student.id)"
              :busy-student-id="busyStudentId"
              :busy-ticket-id="busyTicketId"
              :printing-ticket-id="printingTicketId"
              :can-issue="canIssueTickets"
              :issue-disabled-reason="issueDisabledReason"
              :disabled="!isManageableStudent(student)"
              :disabled-reason="managementReason(student)"
              @issue="emit('issue', $event)"
              @cancel="emit('cancel', $event)"
              @change-end-date="emit('changeEndDate', $event)"
              @reissue="emit('reissue', $event)"
              @print="emit('print', $event)"
              @toggle-active="emit('toggleActive', $event)"
              @open="emit('open', $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.students-table {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
}

table {
  width: 100%;
  min-width: 1130px;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 18px;
}

th,
td {
  min-height: 40px;
  padding: 8px 10px;
  border-top: 1px solid #edf1f5;
  text-align: left;
  vertical-align: middle;
}

thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  border-top: 0;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
}

tbody tr:hover {
  background: #fafcfd;
}

.select-col {
  width: 38px;
  padding-left: 12px;
  padding-right: 6px;
  text-align: center;
}

.select-col input {
  width: 16px;
  height: 16px;
  accent-color: #16a34a;
}

.student-main,
.building-copy,
.meal-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.student-main strong {
  color: #0f172a;
  font-size: 13px;
  line-height: 18px;
}

.student-main small,
.muted-text,
.building-copy {
  color: #64748b;
  font-size: 12px;
  line-height: 16px;
}

.building-copy {
  max-width: 156px;
  line-height: 16px;
}

.meal-copy span {
  white-space: nowrap;
}

.meal-copy {
  gap: 1px;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
}

.header-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.info-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  color: #94a3b8;
  font-size: 11px;
  font-style: normal;
}

.meal-building-col {
  width: 144px;
}

.meal-building-cell {
  min-width: 144px;
}

.ticket-period {
  min-width: 136px;
  color: #334155;
  font-size: 12px;
  line-height: 16px;
}

.student-row--attention {
  background: #fff7ed;
}

.student-row--selected {
  background: #f0fdf4;
  box-shadow: inset 3px 0 0 #16a34a;
}

.student-row--inactive {
  color: #64748b;
}

.student-row--restricted {
  background-image: linear-gradient(0deg, rgba(248, 250, 252, 0.96), rgba(248, 250, 252, 0.96));
}

.actions-col {
  width: 126px;
  white-space: nowrap;
  text-align: left;
  padding-left: 2px;
  padding-right: 8px;
}

.empty {
  padding: 28px 16px;
  text-align: center;
  color: #64748b;
}
</style>
