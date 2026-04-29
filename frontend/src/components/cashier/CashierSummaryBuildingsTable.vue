<script setup lang="ts">
import type { CashierSummaryBuildingsTable } from '@/types'
import { formatCashierSummaryCurrency } from '@/utils/cashierSummaryPresentation'

defineProps<{
  table: CashierSummaryBuildingsTable
}>()
</script>

<template>
  <section class="cashier-buildings-section">
    <header class="cashier-buildings-head">
      <div>
        <p class="cashier-buildings-eyebrow">Свод по всем корпусам</p>
        <h2>Разбивка по типам питания и стоимости</h2>
      </div>
    </header>

    <div class="cashier-buildings-table-wrap">
      <table class="cashier-buildings-table">
        <thead>
          <tr>
            <th>Корпус</th>
            <th>Тип питания</th>
            <th>Цена</th>
            <th>Кол-во</th>
            <th>Сумма</th>
            <th>Итого по корпусу</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="building in table.rows" :key="building.building_id">
            <template v-if="building.line_items.length">
              <tr>
                <th :rowspan="building.line_items.length">{{ building.building_name }}</th>
                <td>{{ building.line_items[0]?.meal_type_label }}</td>
                <td>{{ formatCashierSummaryCurrency(building.line_items[0]?.price ?? 0) }}</td>
                <td>{{ building.line_items[0]?.count }}</td>
                <td>{{ formatCashierSummaryCurrency(building.line_items[0]?.amount ?? 0) }}</td>
                <td :rowspan="building.line_items.length" class="cashier-buildings-total-cell">
                  <strong>{{ building.total_count }}</strong>
                  <span>{{ formatCashierSummaryCurrency(building.total_amount) }}</span>
                </td>
              </tr>
              <tr
                v-for="lineItem in building.line_items.slice(1)"
                :key="`${building.building_id}-${lineItem.meal_type}-${lineItem.price}`"
              >
                <td>{{ lineItem.meal_type_label }}</td>
                <td>{{ formatCashierSummaryCurrency(lineItem.price) }}</td>
                <td>{{ lineItem.count }}</td>
                <td>{{ formatCashierSummaryCurrency(lineItem.amount) }}</td>
              </tr>
            </template>
            <tr v-else>
              <th>{{ building.building_name }}</th>
              <td colspan="4" class="cashier-buildings-empty-cell">Выдач за период не было</td>
              <td class="cashier-buildings-total-cell">
                <strong>{{ building.total_count }}</strong>
                <span>{{ formatCashierSummaryCurrency(building.total_amount) }}</span>
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr>
            <th colspan="3">Общий итог</th>
            <td>{{ table.totals.total_count }}</td>
            <td>{{ formatCashierSummaryCurrency(table.totals.total_amount) }}</td>
            <td>{{ table.totals.line_items.length }} строк(и) разбивки</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div v-if="table.totals.line_items.length" class="cashier-breakdown-card">
      <div class="cashier-breakdown-head">
        <div>
          <p class="cashier-buildings-eyebrow">Общий срез</p>
          <h3>Все корпуса вместе</h3>
        </div>
      </div>

      <div class="cashier-breakdown-grid">
        <article
          v-for="lineItem in table.totals.line_items"
          :key="`total-${lineItem.meal_type}-${lineItem.price}`"
          class="cashier-breakdown-item"
        >
          <span>{{ lineItem.meal_type_label }}</span>
          <strong>{{ formatCashierSummaryCurrency(lineItem.price) }}</strong>
          <b>{{ lineItem.count }} шт.</b>
          <em>{{ formatCashierSummaryCurrency(lineItem.amount) }}</em>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cashier-buildings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: var(--shadow);
}

.cashier-buildings-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
}

.cashier-buildings-eyebrow {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cashier-buildings-head h2 {
  margin: 0;
}

.cashier-buildings-table-wrap {
  overflow-x: auto;
}

.cashier-buildings-table {
  width: 100%;
  border-collapse: collapse;
}

.cashier-buildings-table th,
.cashier-buildings-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  text-align: left;
  vertical-align: top;
}

.cashier-buildings-table thead th {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cashier-buildings-table tbody th,
.cashier-buildings-table tfoot th {
  color: var(--text);
}

.cashier-buildings-total-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 170px;
}

.cashier-buildings-total-cell strong {
  color: var(--text);
  font-size: 1rem;
}

.cashier-buildings-total-cell span,
.cashier-buildings-empty-cell {
  color: var(--muted);
}

.cashier-buildings-table tfoot th,
.cashier-buildings-table tfoot td {
  background: rgba(15, 23, 42, 0.04);
  font-weight: 700;
}

.cashier-breakdown-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 250, 252, 0.88);
}

.cashier-breakdown-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
}

.cashier-breakdown-head h3 {
  margin: 0;
}

.cashier-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.cashier-breakdown-item {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.84);
}

.cashier-breakdown-item span,
.cashier-breakdown-item em {
  color: var(--muted);
}

.cashier-breakdown-item strong,
.cashier-breakdown-item b {
  color: var(--text);
}

.cashier-breakdown-item em {
  font-style: normal;
  font-weight: 700;
}

@media (max-width: 760px) {
  .cashier-buildings-head,
  .cashier-breakdown-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
