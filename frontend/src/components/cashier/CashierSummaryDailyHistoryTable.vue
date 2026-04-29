<script setup lang="ts">
import type { CashierSummaryDayRow } from '@/types'
import { formatCashierSummaryCurrency, formatCashierSummaryDay } from '@/utils/cashierSummaryPresentation'

defineProps<{
  rows: CashierSummaryDayRow[]
  scopeLabel: string
}>()
</script>

<template>
  <section class="cashier-summary-section">
    <header class="cashier-summary-section-head">
      <div>
        <p class="cashier-summary-eyebrow">Динамика по дням</p>
        <h2>{{ scopeLabel }}</h2>
      </div>
    </header>

    <div class="cashier-summary-table-wrap">
      <table v-if="rows.length" class="cashier-summary-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Выдач</th>
            <th>Завтраков</th>
            <th>Обедов</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.issue_date" :class="{ 'is-today': index === 0 }">
            <th>{{ formatCashierSummaryDay(row.issue_date) }}</th>
            <td>{{ row.count }}</td>
            <td>{{ row.breakfast_count }}</td>
            <td>{{ row.lunch_count }}</td>
            <td>{{ formatCashierSummaryCurrency(row.amount) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="cashier-summary-empty">За выбранный период выдач нет.</div>
    </div>
  </section>
</template>

<style scoped>
.cashier-summary-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: var(--shadow);
}

.cashier-summary-section-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
}

.cashier-summary-eyebrow {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cashier-summary-section-head h2 {
  margin: 0;
}

.cashier-summary-table-wrap {
  overflow-x: auto;
}

.cashier-summary-table {
  width: 100%;
  border-collapse: collapse;
}

.cashier-summary-table th,
.cashier-summary-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  text-align: left;
  white-space: nowrap;
}

.cashier-summary-table thead th {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cashier-summary-table tbody th {
  color: var(--text);
}

.cashier-summary-table tbody tr.is-today {
  background: rgba(29, 78, 216, 0.05);
}

.cashier-summary-empty {
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.64);
  color: var(--muted);
}

@media (max-width: 760px) {
  .cashier-summary-section-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
