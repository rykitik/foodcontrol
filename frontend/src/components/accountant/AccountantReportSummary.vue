<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import type { AccountantSummaryRow } from '@/utils/accountantReportPresentation'
import { formatAccountingMoney } from '@/utils/accountantReportPresentation'

defineProps<{
  rowCount: number
  totalCount: number
  totalAmount: number
  categoryCount: number
  rows: AccountantSummaryRow[]
  updatedAt: string
  ready?: boolean
}>()
</script>

<template>
  <aside class="accountant-summary">
    <h2>Сводка</h2>

    <dl class="accountant-summary__stats">
      <div>
        <dt>Строк в документе</dt>
        <dd>{{ rowCount }}</dd>
      </div>
      <div>
        <dt>Выдач</dt>
        <dd>{{ totalCount }}</dd>
      </div>
      <div>
        <dt>Сумма</dt>
        <dd>{{ formatAccountingMoney(totalAmount) }}</dd>
      </div>
      <div>
        <dt>Категорий</dt>
        <dd>{{ categoryCount }}</dd>
      </div>
    </dl>

    <section class="accountant-summary__categories">
      <h3>По категориям</h3>
      <div v-if="rows.length" class="accountant-summary__rows">
        <article v-for="row in rows" :key="row.key" class="accountant-summary-row">
          <div>
            <strong>{{ row.category }}</strong>
            <span>{{ row.mealLabel }}</span>
          </div>
          <div>
            <span>{{ row.count }} шт.</span>
            <strong>{{ formatAccountingMoney(row.amount) }}</strong>
          </div>
        </article>
      </div>
      <div v-else class="accountant-summary__empty">Нет данных за выбранный период.</div>
    </section>

    <footer class="accountant-summary__footer">
      <div>
        <AppIcon name="clock" />
        <span>Последнее обновление</span>
        <strong>{{ updatedAt }}</strong>
      </div>
      <div>
        <AppIcon name="check" />
        <span>Статус</span>
        <strong>{{ ready ? 'Готово к печати' : 'Нет документа' }}</strong>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.accountant-summary {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 18px;
  border: 1px solid #dbe5f0;
  border-radius: 8px;
  background: #fff;
}

.accountant-summary h2,
.accountant-summary h3,
.accountant-summary dl,
.accountant-summary dd {
  margin: 0;
}

.accountant-summary h2 {
  color: #0f172a;
  font-size: 18px;
  line-height: 24px;
}

.accountant-summary h3 {
  color: #0f172a;
  font-size: 15px;
  line-height: 20px;
}

.accountant-summary__stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.accountant-summary__stats div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.accountant-summary__stats dt {
  color: #64748b;
  font-size: 14px;
}

.accountant-summary__stats dd {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}

.accountant-summary__categories {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}

.accountant-summary__rows {
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.accountant-summary-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.accountant-summary-row:last-child {
  border-bottom: 0;
}

.accountant-summary-row div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.accountant-summary-row div:last-child {
  align-items: flex-end;
}

.accountant-summary-row strong {
  color: #0f172a;
  font-size: 14px;
  line-height: 18px;
}

.accountant-summary-row span {
  color: #64748b;
  font-size: 13px;
  line-height: 18px;
}

.accountant-summary__empty {
  padding: 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 14px;
}

.accountant-summary__footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.accountant-summary__footer div {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.accountant-summary__footer span {
  color: #64748b;
  font-size: 13px;
}

.accountant-summary__footer strong {
  color: #15803d;
  font-size: 13px;
  white-space: nowrap;
}
</style>
