<script setup lang="ts">
import TicketStatusChip from '@/components/tickets/TicketStatusChip.vue'
import { ticketStatusFilterOptions } from '@/config/options'
import type { Ticket, TicketStatus } from '@/types'
import { formatStudentDateRange, formatTicketMonthYear } from '@/utils/studentDetailPresentation'
import { getStudentTicketListNote } from '@/utils/studentTicketPresentation'

defineProps<{
  tickets: Ticket[]
  selectedTicketId: string | null
  ticketFilter: {
    month: number | null
    year: number | null
    status: TicketStatus | 'all'
  }
  monthFilterOptions: Array<{ label: string; value: number | null }>
  yearFilterOptions: Array<{ label: string; value: number | null }>
}>()

const emit = defineEmits<{
  select: [ticketId: string]
  refresh: []
  reset: []
}>()

function ticketCountLabel(count: number) {
  if (count === 1) {
    return '1 талон'
  }

  if (count >= 2 && count <= 4) {
    return `${count} талона`
  }

  return `${count} талонов`
}

function issueCountValue(ticket: Ticket) {
  return ticket.meal_records_count ?? 0
}
</script>

<template>
  <p-card class="content-card student-ticket-panel">
    <template #title>
      <div class="student-ticket-panel__title">
        <span>Талоны студента</span>
        <span class="student-ticket-panel__count">{{ ticketCountLabel(tickets.length) }}</span>
      </div>
    </template>

    <template #content>
      <div class="student-ticket-panel__filters-card">
        <div class="student-ticket-panel__filters form-grid">
          <label class="field">
            <span>Месяц</span>
            <p-dropdown
              v-model="ticketFilter.month"
              :options="monthFilterOptions"
              option-label="label"
              option-value="value"
            />
          </label>

          <label class="field">
            <span>Год</span>
            <p-dropdown
              v-model="ticketFilter.year"
              :options="yearFilterOptions"
              option-label="label"
              option-value="value"
            />
          </label>

          <label class="field">
            <span>Состояние</span>
            <p-dropdown
              v-model="ticketFilter.status"
              :options="ticketStatusFilterOptions"
              option-label="label"
              option-value="value"
            />
          </label>
        </div>

        <div class="student-ticket-panel__actions">
          <p-button label="Показать" @click="emit('refresh')" />
          <p-button label="Сбросить" severity="secondary" outlined @click="emit('reset')" />
        </div>
      </div>

      <template v-if="tickets.length">
        <div class="student-ticket-register">
          <div class="student-ticket-list-head">
            <span>Период</span>
            <span>Категория</span>
            <span>Статус</span>
            <span>Кто оформил</span>
            <span class="student-ticket-list-head__count">Выдач</span>
          </div>

          <div class="student-ticket-list">
            <button
              v-for="ticket in tickets"
              :key="ticket.id"
              type="button"
              class="student-ticket-item"
              :class="{ 'student-ticket-item--selected': selectedTicketId === ticket.id }"
              :aria-pressed="selectedTicketId === ticket.id"
              @click="emit('select', ticket.id)"
            >
              <div class="student-ticket-item__period" data-label="Период">
                <strong>{{ formatTicketMonthYear(ticket.month, ticket.year) }}</strong>
                <small>{{ formatStudentDateRange(ticket.start_date, ticket.end_date) }}</small>
              </div>

              <div class="student-ticket-item__cell" data-label="Категория">
                <strong>{{ ticket.category_name }}</strong>
              </div>

              <div class="student-ticket-item__status" data-label="Статус">
                <TicketStatusChip :status="ticket.status" />
                <small>{{ getStudentTicketListNote(ticket) }}</small>
              </div>

              <div class="student-ticket-item__cell" data-label="Кто оформил">
                <strong>{{ ticket.created_by_name }}</strong>
              </div>

              <div class="student-ticket-item__count" data-label="Выдач">
                <strong>{{ issueCountValue(ticket) }}</strong>
              </div>
            </button>
          </div>
        </div>
      </template>

      <div v-else class="student-ticket-empty">
        <strong>По выбранным параметрам талонов нет.</strong>
        <p>Измените месяц, год или состояние.</p>
      </div>
    </template>
  </p-card>
</template>

<style scoped>
.student-ticket-panel :deep(.p-card-body) {
  gap: var(--student-detail-space-4, 20px);
}

.student-ticket-panel__title,
.student-ticket-panel__actions,
.student-ticket-item__period,
.student-ticket-item__status,
.student-ticket-item__cell,
.student-ticket-empty {
  display: flex;
}

.student-ticket-panel__title {
  align-items: center;
  gap: 12px;
}

.student-ticket-panel__count {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 0.9rem;
  font-weight: 700;
}

.student-ticket-panel__filters-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #dbe3ee;
  border-radius: 18px;
  background: #fff;
}

.student-ticket-panel__filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.student-ticket-panel__actions {
  flex-wrap: wrap;
  gap: 12px;
}

.student-ticket-register {
  border: 1px solid #dbe3ee;
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
}

.student-ticket-list-head,
.student-ticket-item {
  display: grid;
  grid-template-columns: minmax(220px, 1.12fr) minmax(140px, 0.78fr) minmax(160px, 0.86fr) minmax(0, 1fr) 72px;
  gap: 16px;
  align-items: center;
}

.student-ticket-list-head {
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.student-ticket-list-head span {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
}

.student-ticket-list-head__count {
  text-align: right;
}

.student-ticket-list {
  display: flex;
  flex-direction: column;
}

.student-ticket-item {
  width: 100%;
  padding: 18px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  text-align: left;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.student-ticket-item:last-child {
  border-bottom: 0;
}

.student-ticket-item:hover,
.student-ticket-item:focus-visible {
  background: #f8fafc;
}

.student-ticket-item--selected {
  background: #eff6ff;
  box-shadow: inset 4px 0 0 #2563eb;
}

.student-ticket-item__period,
.student-ticket-item__status,
.student-ticket-item__cell,
.student-ticket-empty {
  flex-direction: column;
}

.student-ticket-item__period {
  gap: 6px;
}

.student-ticket-item__period strong,
.student-ticket-item__cell strong,
.student-ticket-item__count strong {
  color: #0f172a;
}

.student-ticket-item__period small,
.student-ticket-item__status small {
  color: #64748b;
  line-height: 1.4;
}

.student-ticket-item__status {
  gap: 8px;
  align-items: flex-start;
}

.student-ticket-item__count {
  text-align: right;
}

.student-ticket-item__count strong {
  font-size: 1.2rem;
  line-height: 1;
}

.student-ticket-empty {
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: 18px;
  border: 1px dashed #cbd5e1;
  background: #fff;
}

.student-ticket-empty p {
  margin: 0;
  color: #64748b;
}

@media (max-width: 980px) {
  .student-ticket-panel__filters,
  .student-ticket-list-head,
  .student-ticket-item {
    grid-template-columns: 1fr;
  }

  .student-ticket-list-head {
    display: none;
  }

  .student-ticket-item__count {
    text-align: left;
  }

  .student-ticket-item__period::before,
  .student-ticket-item__cell::before,
  .student-ticket-item__status::before,
  .student-ticket-item__count::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 4px;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 700;
  }
}
</style>
