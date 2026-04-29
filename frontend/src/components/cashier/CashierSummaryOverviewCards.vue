<script setup lang="ts">
import { computed } from 'vue'

import type { CashierDailySummary } from '@/types'
import { formatCashierSummaryCurrency } from '@/utils/cashierSummaryPresentation'

const props = defineProps<{
  summary: CashierDailySummary
}>()

const groups = computed(() => [
  {
    key: 'history',
    label: 'По корпусу',
    title: props.summary.scope.history_scope_label,
    totals: props.summary.overview.history_scope,
  },
  {
    key: 'network',
    label: 'Все корпуса',
    title: 'Все корпуса',
    totals: props.summary.overview.all_buildings,
  },
])

function formatValue(value: number, isCurrency = false): string {
  return isCurrency ? formatCashierSummaryCurrency(value) : String(value)
}
</script>

<template>
  <section class="cashier-overview-grid">
    <article v-for="group in groups" :key="group.key" class="cashier-overview-card">
      <header class="cashier-overview-head">
        <div>
          <p class="cashier-overview-label">{{ group.label }}</p>
          <h2>{{ group.title }}</h2>
        </div>
      </header>

      <div class="cashier-overview-stats">
        <div class="cashier-overview-stat">
          <span>Выдач</span>
          <strong>{{ formatValue(group.totals.count) }}</strong>
        </div>
        <div class="cashier-overview-stat">
          <span>Завтраков</span>
          <strong>{{ formatValue(group.totals.breakfast_count) }}</strong>
        </div>
        <div class="cashier-overview-stat">
          <span>Обедов</span>
          <strong>{{ formatValue(group.totals.lunch_count) }}</strong>
        </div>
        <div class="cashier-overview-stat">
          <span>Сумма</span>
          <strong>{{ formatValue(group.totals.amount, true) }}</strong>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.cashier-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.cashier-overview-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.88)),
    rgba(255, 255, 255, 0.86);
  box-shadow: var(--shadow);
}

.cashier-overview-head h2 {
  margin: 4px 0 0;
  color: var(--text);
  font-size: 1.3rem;
}

.cashier-overview-label {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cashier-overview-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cashier-overview-stat {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.78);
}

.cashier-overview-stat span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.cashier-overview-stat strong {
  color: var(--text);
  font-size: clamp(1.2rem, 2vw, 1.8rem);
  line-height: 1.1;
}

@media (max-width: 1180px) {
  .cashier-overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .cashier-overview-stats {
    grid-template-columns: 1fr;
  }
}
</style>
