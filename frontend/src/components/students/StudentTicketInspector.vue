<script setup lang="ts">
import { computed } from 'vue'

import TicketStatusChip from '@/components/tickets/TicketStatusChip.vue'
import type { Ticket } from '@/types'
import {
  formatStudentDateRange,
  formatStudentDateTime,
  formatTicketIssueCount,
  formatTicketMonthYear,
} from '@/utils/studentDetailPresentation'
import {
  canCancelStudentTicket,
  getStudentTicketAction,
  getStudentTicketState,
} from '@/utils/studentTicketPresentation'

const props = defineProps<{
  ticket: Ticket | null
  canManageTickets: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  cancel: [ticket: Ticket]
  changeEndDate: [ticket: Ticket]
}>()

const canCancel = computed(() => canCancelStudentTicket(props.ticket, props.canManageTickets))
const canChangeEndDate = computed(() => Boolean(props.canManageTickets && props.ticket && props.ticket.status !== 'cancelled'))
const ticketState = computed(() => (props.ticket ? getStudentTicketState(props.ticket) : null))
const ticketAction = computed(() => (props.ticket ? getStudentTicketAction(props.ticket, props.canManageTickets) : null))

const mealBuildingLabel = computed(() => {
  if (!props.ticket) {
    return '—'
  }

  if (props.ticket.allow_all_meal_buildings) {
    return 'Все корпуса'
  }

  return (
    props.ticket.effective_meal_building_name ||
    props.ticket.meal_building_name ||
    `Корпус ${props.ticket.effective_meal_building_id ?? props.ticket.building_id ?? props.ticket.source_building_id ?? '—'}`
  )
})

const factCards = computed(() => {
  if (!props.ticket) {
    return []
  }

  return [
    {
      key: 'issues',
      label: 'Выдач по талону',
      value: formatTicketIssueCount(props.ticket.meal_records_count),
    },
    {
      key: 'category',
      label: 'Категория',
      value: props.ticket.category_name,
    },
    {
      key: 'building',
      label: 'Корпус питания',
      value: mealBuildingLabel.value,
    },
  ]
})
</script>

<template>
  <p-card class="content-card student-ticket-inspector">
    <template #title>Детали талона</template>

    <template #content>
      <div v-if="ticket && ticketState" class="student-ticket-inspector__body">
        <header class="student-ticket-inspector__hero">
          <div class="student-ticket-inspector__hero-copy">
            <div class="student-ticket-inspector__hero-top">
              <span class="student-ticket-inspector__period-label">
                Период: {{ formatTicketMonthYear(ticket.month, ticket.year) }}
              </span>
              <TicketStatusChip :status="ticket.status" />
            </div>

            <strong>{{ ticketState.title }}</strong>
          </div>

          <span class="student-ticket-inspector__hero-dates">
            {{ formatStudentDateRange(ticket.start_date, ticket.end_date) }}
          </span>
        </header>

        <section class="student-ticket-inspector__facts">
          <article v-for="fact in factCards" :key="fact.key" class="student-ticket-inspector__fact">
            <span>{{ fact.label }}</span>
            <strong>{{ fact.value }}</strong>
          </article>
        </section>

        <div
          v-if="ticketAction"
          class="student-ticket-inspector__callout"
          :class="`student-ticket-inspector__callout--${ticketAction.tone}`"
        >
          <strong>{{ ticketAction.title }}</strong>
          <p>{{ ticketAction.description }}</p>
        </div>

        <section class="student-ticket-inspector__section">
          <dl class="student-ticket-inspector__details">
            <div>
              <dt>Кто оформил</dt>
              <dd>{{ ticket.created_by_name }}</dd>
            </div>
            <div>
              <dt>Создан</dt>
              <dd>{{ formatStudentDateTime(ticket.created_at) }}</dd>
            </div>
            <div>
              <dt>QR-код</dt>
              <dd>{{ ticket.qr_code }}</dd>
            </div>
          </dl>
        </section>

        <footer v-if="canChangeEndDate || canCancel" class="student-ticket-inspector__actions">
          <p-button
            v-if="canChangeEndDate"
            label="Изменить срок действия"
            severity="secondary"
            outlined
            :loading="saving"
            @click="emit('changeEndDate', ticket)"
          />
          <p-button
            v-if="canCancel"
            label="Отменить талон"
            severity="danger"
            :loading="saving"
            @click="emit('cancel', ticket)"
          />
        </footer>
      </div>

      <div v-else class="student-ticket-inspector__empty">
        <strong>Талон не выбран</strong>
        <p>Выберите запись слева, чтобы увидеть период, статус и детали талона.</p>
      </div>
    </template>
  </p-card>
</template>

<style scoped>
.student-ticket-inspector :deep(.p-card-body) {
  gap: var(--student-detail-space-4, 20px);
}

.student-ticket-inspector__body,
.student-ticket-inspector__hero-copy,
.student-ticket-inspector__fact,
.student-ticket-inspector__section,
.student-ticket-inspector__callout,
.student-ticket-inspector__empty {
  display: flex;
  flex-direction: column;
}

.student-ticket-inspector__body {
  gap: 20px;
}

.student-ticket-inspector__hero,
.student-ticket-inspector__hero-top,
.student-ticket-inspector__actions {
  display: flex;
}

.student-ticket-inspector__hero {
  flex-direction: column;
  gap: 14px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e5e7eb;
}

.student-ticket-inspector__hero-copy {
  gap: 10px;
}

.student-ticket-inspector__hero-top {
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.student-ticket-inspector__period-label {
  color: #2563eb;
  font-size: 0.95rem;
  font-weight: 700;
}

.student-ticket-inspector__hero-copy strong {
  color: #0f172a;
  font-size: 1.35rem;
  line-height: 1.2;
}

.student-ticket-inspector__hero-dates,
.student-ticket-inspector__callout p,
.student-ticket-inspector__empty p {
  margin: 0;
  color: #64748b;
  line-height: 1.45;
}

.student-ticket-inspector__facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.student-ticket-inspector__fact {
  gap: 8px;
  padding: 16px;
  border: 1px solid #dbe3ee;
  border-radius: 16px;
  background: #fff;
}

.student-ticket-inspector__fact span,
.student-ticket-inspector__details dt {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.35;
}

.student-ticket-inspector__fact strong,
.student-ticket-inspector__callout strong,
.student-ticket-inspector__details dd,
.student-ticket-inspector__empty strong {
  color: #0f172a;
}

.student-ticket-inspector__callout {
  gap: 8px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #dbe3ee;
  background: #f8fafc;
}

.student-ticket-inspector__callout--action {
  border-color: rgba(34, 197, 94, 0.18);
  background: rgba(240, 253, 244, 0.9);
}

.student-ticket-inspector__callout--warning {
  border-color: rgba(249, 115, 22, 0.2);
  background: rgba(255, 247, 237, 0.92);
}

.student-ticket-inspector__details {
  margin: 0;
}

.student-ticket-inspector__details div {
  padding: 14px 0;
  border-bottom: 1px solid #e5e7eb;
}

.student-ticket-inspector__details div:first-child {
  padding-top: 0;
}

.student-ticket-inspector__details div:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.student-ticket-inspector__details dd {
  margin: 8px 0 0;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.student-ticket-inspector__actions {
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

.student-ticket-inspector__empty {
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px dashed #cbd5e1;
  background: #fff;
}

@media (max-width: 900px) {
  .student-ticket-inspector__facts {
    grid-template-columns: 1fr;
  }
}
</style>
