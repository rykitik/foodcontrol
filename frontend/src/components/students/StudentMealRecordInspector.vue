<script setup lang="ts">
import { computed } from 'vue'

import { mealTypeLabels } from '@/config/options'
import type { MealRecord } from '@/types'
import { formatStudentCurrency, formatStudentDateTime } from '@/utils/studentDetailPresentation'

const props = defineProps<{
  record: MealRecord | null
}>()

const issuedAtLabel = computed(() => {
  if (!props.record) {
    return '—'
  }

  return formatStudentDateTime(`${props.record.issue_date}T${props.record.issue_time}`)
})
</script>

<template>
  <section class="student-history-inspector">
    <div v-if="record" class="student-history-inspector__body">
      <header class="student-history-inspector__hero">
        <div class="student-history-inspector__hero-copy">
          <span class="student-history-inspector__eyebrow">Детали выдачи</span>
          <strong>{{ mealTypeLabels[record.meal_type] }}</strong>
          <p>{{ record.category_name }}</p>
        </div>

        <span class="student-history-inspector__amount">{{ formatStudentCurrency(record.price) }}</span>
      </header>

      <section class="student-history-inspector__facts">
        <article class="student-history-inspector__fact">
          <span>Дата и время</span>
          <strong>{{ issuedAtLabel }}</strong>
        </article>

        <article class="student-history-inspector__fact">
          <span>Оформил</span>
          <strong>{{ record.issued_by_name }}</strong>
        </article>
      </section>

      <section class="student-history-inspector__section">
        <h3 class="student-history-inspector__section-title">Примечание</h3>
        <p>{{ record.notes || 'Примечание не указано.' }}</p>
      </section>

      <section class="student-history-inspector__section">
        <h3 class="student-history-inspector__section-title">Служебные данные</h3>
        <dl class="student-history-inspector__details">
          <div>
            <dt>ID записи</dt>
            <dd>{{ record.id }}</dd>
          </div>
          <div>
            <dt>ID талона</dt>
            <dd>{{ record.ticket_id }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <div v-else class="student-history-inspector__empty">
      <strong>Запись не выбрана</strong>
      <p>Выберите строку в журнале слева, чтобы увидеть детали выдачи.</p>
    </div>
  </section>
</template>

<style scoped>
.student-history-inspector,
.student-history-inspector__body,
.student-history-inspector__hero-copy,
.student-history-inspector__fact,
.student-history-inspector__section,
.student-history-inspector__empty {
  display: flex;
  flex-direction: column;
}

.student-history-inspector {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid #dbe3ee;
  background: #fff;
}

.student-history-inspector__body {
  gap: 18px;
}

.student-history-inspector__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.student-history-inspector__hero-copy {
  gap: 8px;
}

.student-history-inspector__eyebrow {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.student-history-inspector__hero-copy strong,
.student-history-inspector__fact strong,
.student-history-inspector__details dd,
.student-history-inspector__empty strong {
  color: #0f172a;
}

.student-history-inspector__hero-copy strong {
  font-size: 1.25rem;
  line-height: 1.2;
}

.student-history-inspector__hero-copy p,
.student-history-inspector__section p,
.student-history-inspector__empty p {
  margin: 0;
  color: #64748b;
  line-height: 1.45;
}

.student-history-inspector__amount {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-weight: 700;
  white-space: nowrap;
}

.student-history-inspector__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.student-history-inspector__fact {
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid #dbe3ee;
  background: #fff;
}

.student-history-inspector__fact span,
.student-history-inspector__details dt {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.35;
}

.student-history-inspector__section {
  gap: 10px;
}

.student-history-inspector__section-title {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
}

.student-history-inspector__details {
  margin: 0;
}

.student-history-inspector__details div {
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

.student-history-inspector__details div:first-child {
  padding-top: 0;
}

.student-history-inspector__details div:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.student-history-inspector__details dd {
  margin: 6px 0 0;
  font-weight: 700;
  line-height: 1.45;
  word-break: break-word;
}

.student-history-inspector__empty {
  gap: 12px;
  padding: 12px 4px;
}

@media (max-width: 900px) {
  .student-history-inspector__hero {
    flex-direction: column;
  }

  .student-history-inspector__facts {
    grid-template-columns: 1fr;
  }
}
</style>
