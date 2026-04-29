<script setup lang="ts">
import type { CashierJournalAttentionItem } from '@/types'

const props = defineProps<{
  items: CashierJournalAttentionItem[]
}>()
</script>

<template>
  <section class="cashier-journal-panel">
    <header class="cashier-journal-panel-head">
      <div>
        <p class="eyebrow">Проверка</p>
        <h2>Что проверить в журнале</h2>
      </div>
      <strong>{{ `${props.items.length} записей` }}</strong>
    </header>

    <div v-if="props.items.length" class="cashier-journal-attention-list">
      <article v-for="item in props.items" :key="item.student_id" class="cashier-journal-attention-item">
        <div class="cashier-journal-attention-title">
          <strong>{{ item.student_name }}</strong>
          <span>{{ `${item.group_name} · ${item.student_card}` }}</span>
        </div>

        <div class="cashier-journal-badges">
          <span v-for="label in item.labels" :key="label" class="cashier-journal-badge">
            {{ label }}
          </span>
        </div>

        <div class="cashier-journal-reasons">
          <p v-for="reason in item.reasons" :key="reason">{{ reason }}</p>
        </div>

        <div class="cashier-journal-meta">
          <span>{{ `Питание: ${item.meal_type_labels.join(', ')}` }}</span>
          <span>
            {{ `Корпуса: ${item.buildings.map((building) => building.building_name).join(', ')}` }}
          </span>
          <span>{{ `Связанных записей: ${item.record_count}` }}</span>
        </div>
      </article>
    </div>

    <div v-else class="cashier-journal-empty">
      Серверный журнал не нашёл подозрительных записей за текущий день.
    </div>
  </section>
</template>

<style scoped>
.cashier-journal-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--shadow);
}

.cashier-journal-panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.cashier-journal-panel-head h2 {
  margin: 6px 0 0;
  font-size: 1.1rem;
  color: var(--text);
}

.cashier-journal-panel-head strong {
  color: var(--text);
}

.cashier-journal-attention-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cashier-journal-attention-item {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(180, 83, 9, 0.2);
  background: rgba(255, 251, 235, 0.92);
}

.cashier-journal-attention-title {
  display: grid;
  gap: 4px;
}

.cashier-journal-attention-title strong {
  color: var(--text);
}

.cashier-journal-attention-title span,
.cashier-journal-reasons p,
.cashier-journal-meta span {
  color: var(--muted);
  margin: 0;
  font-weight: 600;
}

.cashier-journal-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cashier-journal-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(146, 64, 14, 0.1);
  color: #92400e;
  font-size: 0.82rem;
  font-weight: 700;
}

.cashier-journal-reasons {
  display: grid;
  gap: 6px;
}

.cashier-journal-meta {
  display: grid;
  gap: 6px;
}

.cashier-journal-empty {
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
}

@media (max-width: 760px) {
  .cashier-journal-panel-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
