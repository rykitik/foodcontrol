<script setup lang="ts">
import type { CashierJournalRecord } from '@/types'
import { formatCashierJournalTime } from '@/utils/cashierJournalPresentation'

const props = defineProps<{
  records: CashierJournalRecord[]
}>()
</script>

<template>
  <section class="cashier-journal-table-card">
    <header class="cashier-journal-table-head">
      <div>
        <p class="eyebrow">Записи</p>
        <h2>Выдачи за день</h2>
      </div>
      <strong>{{ `${props.records.length} записей` }}</strong>
    </header>

    <div v-if="props.records.length" class="cashier-journal-table-wrap">
      <table class="cashier-journal-table">
        <thead>
          <tr>
            <th>Время</th>
            <th>Студент</th>
            <th>Питание</th>
            <th>Кассир</th>
            <th>Корпус</th>
            <th>Проверка</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in props.records" :key="record.id" :class="{ attention: record.has_attention }">
            <td>{{ formatCashierJournalTime(record.issue_time) }}</td>
            <td>
              <strong>{{ record.student_name }}</strong>
              <p>{{ `${record.group_name} · ${record.student_card}` }}</p>
            </td>
            <td>
              <strong>{{ record.meal_type_label }}</strong>
              <p>{{ `${record.price.toFixed(2)} ₽` }}</p>
            </td>
            <td>{{ record.issued_by_name }}</td>
            <td>
              <strong>{{ record.building_name || `Корпус ${record.building_id}` }}</strong>
              <p>{{ `Корпус питания: ${record.effective_meal_building_name || 'не указан'}` }}</p>
            </td>
            <td>
              <div v-if="record.attention_flags.length" class="cashier-journal-flag-list">
                <div v-for="flag in record.attention_flags" :key="flag.code" class="cashier-journal-flag" :class="`tone-${flag.tone}`">
                  <strong>{{ flag.label }}</strong>
                  <p>{{ flag.description }}</p>
                </div>
              </div>
              <span v-else class="cashier-journal-ok">Без замечаний</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="cashier-journal-empty">
      За выбранный день серверных записей в журнале нет.
    </div>
  </section>
</template>

<style scoped>
.cashier-journal-table-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
}

.cashier-journal-table-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.cashier-journal-table-head h2 {
  margin: 6px 0 0;
  font-size: 1.1rem;
  color: var(--text);
}

.cashier-journal-table-wrap {
  overflow-x: auto;
}

.cashier-journal-table {
  width: 100%;
  border-collapse: collapse;
}

.cashier-journal-table th,
.cashier-journal-table td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
  text-align: left;
  vertical-align: top;
}

.cashier-journal-table th {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cashier-journal-table td strong,
.cashier-journal-flag strong,
.cashier-journal-ok {
  color: var(--text);
}

.cashier-journal-table td p,
.cashier-journal-flag p {
  margin: 4px 0 0;
  color: var(--muted);
}

.cashier-journal-table tr.attention {
  background: rgba(255, 251, 235, 0.36);
}

.cashier-journal-flag-list {
  display: grid;
  gap: 8px;
}

.cashier-journal-flag {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.cashier-journal-flag.tone-warning {
  background: rgba(255, 251, 235, 0.92);
  border-color: rgba(180, 83, 9, 0.2);
}

.cashier-journal-flag.tone-danger {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.18);
}

.cashier-journal-ok {
  font-weight: 700;
}

.cashier-journal-empty {
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
}
</style>
