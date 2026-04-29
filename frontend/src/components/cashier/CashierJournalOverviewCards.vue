<script setup lang="ts">
import type { CashierJournalSummary } from '@/types'

const props = defineProps<{
  summary: CashierJournalSummary
}>()

const cards = [
  {
    key: 'records',
    label: 'Записей за день',
    value: () => props.summary.records_count,
  },
  {
    key: 'attention',
    label: 'Студентов с проверкой',
    value: () => props.summary.attention_students_count,
    tone: 'warning',
  },
  {
    key: 'duplicates',
    label: 'Повторы одного питания',
    value: () => props.summary.duplicate_same_meal_count,
    tone: 'danger',
  },
  {
    key: 'buildings',
    label: 'Выдачи по разным корпусам',
    value: () => props.summary.multiple_buildings_count,
    tone: 'warning',
  },
  {
    key: 'amount',
    label: 'Сумма за день',
    value: () => `${props.summary.total_amount.toFixed(2)} ₽`,
  },
]
</script>

<template>
  <section class="cashier-journal-overview">
    <article
      v-for="card in cards"
      :key="card.key"
      class="cashier-journal-overview-card"
      :class="card.tone ? `tone-${card.tone}` : ''"
    >
      <span>{{ card.label }}</span>
      <strong>{{ card.value() }}</strong>
    </article>
  </section>
</template>

<style scoped>
.cashier-journal-overview {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.cashier-journal-overview-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: var(--radius-xl);
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
}

.cashier-journal-overview-card span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cashier-journal-overview-card strong {
  color: var(--text);
  font-size: clamp(1.4rem, 2vw, 2rem);
  line-height: 1.1;
}

.cashier-journal-overview-card.tone-warning {
  background: rgba(255, 251, 235, 0.92);
  border-color: rgba(180, 83, 9, 0.2);
}

.cashier-journal-overview-card.tone-danger {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.18);
}

@media (max-width: 1180px) {
  .cashier-journal-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .cashier-journal-overview {
    grid-template-columns: 1fr;
  }
}
</style>
