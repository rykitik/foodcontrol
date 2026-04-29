<script setup lang="ts">
import type { CashierJournalScanActivity } from '@/types'
import { formatCashierJournalDateTime } from '@/utils/cashierJournalPresentation'

const props = defineProps<{
  activity: CashierJournalScanActivity
}>()

interface SummaryCard {
  key: string
  label: string
  value: () => number
  tone?: 'success' | 'warning' | 'danger'
}

const summaryCards: SummaryCard[] = [
  {
    key: 'attempts',
    label: 'Попыток',
    value: () => props.activity.attempts_count,
  },
  {
    key: 'blocked',
    label: 'Отклонено',
    value: () => props.activity.blocked_count,
    tone: 'warning',
  },
  {
    key: 'not_found',
    label: 'Не найдено',
    value: () => props.activity.not_found_count,
    tone: 'danger',
  },
  {
    key: 'success',
    label: 'Прошло проверку',
    value: () => props.activity.success_count,
    tone: 'success',
  },
]
</script>

<template>
  <section class="cashier-journal-panel">
    <header class="cashier-journal-panel-head">
      <div>
        <p class="eyebrow">Активность</p>
        <h2>Попытки сканирования</h2>
      </div>
      <strong>{{ `${props.activity.attempts_count} попыток` }}</strong>
    </header>

    <div class="cashier-journal-scan-summary">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="cashier-journal-scan-card"
        :class="card.tone ? `tone-${card.tone}` : ''"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value() }}</strong>
      </article>
    </div>

    <div v-if="props.activity.repeated_attempts.length" class="cashier-journal-subsection">
      <strong>Повторные попытки</strong>
      <article
        v-for="item in props.activity.repeated_attempts"
        :key="item.id"
        class="cashier-journal-inline-item"
        :class="`tone-${item.tone}`"
      >
        <div>
          <span>{{ item.subject }}</span>
          <p>{{ `${item.title} · ${item.description}` }}</p>
        </div>
        <small>{{ `${item.count} раз · ${formatCashierJournalDateTime(item.last_at)}` }}</small>
      </article>
    </div>

    <div v-if="props.activity.latest_attempts.length" class="cashier-journal-subsection">
      <strong>Последние проверки</strong>
      <article
        v-for="attempt in props.activity.latest_attempts"
        :key="attempt.id"
        class="cashier-journal-inline-item"
        :class="`tone-${attempt.tone}`"
      >
        <div>
          <span>{{ attempt.subject }}</span>
          <p>{{ `${attempt.title} · ${attempt.description}` }}</p>
        </div>
        <small>{{ formatCashierJournalDateTime(attempt.created_at) }}</small>
      </article>
    </div>

    <div v-else class="cashier-journal-empty">
      Локальных попыток сканирования пока нет. После работы на терминале они будут появляться
      здесь отдельно от выданного питания.
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

.cashier-journal-scan-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.cashier-journal-scan-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.cashier-journal-scan-card span,
.cashier-journal-inline-item p,
.cashier-journal-inline-item small {
  margin: 0;
  color: var(--muted);
}

.cashier-journal-scan-card strong,
.cashier-journal-inline-item span {
  color: var(--text);
}

.cashier-journal-scan-card.tone-success {
  background: rgba(240, 253, 244, 0.92);
  border-color: rgba(21, 128, 61, 0.16);
}

.cashier-journal-scan-card.tone-warning {
  background: rgba(255, 251, 235, 0.92);
  border-color: rgba(180, 83, 9, 0.2);
}

.cashier-journal-scan-card.tone-danger {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.18);
}

.cashier-journal-subsection {
  display: grid;
  gap: 8px;
}

.cashier-journal-inline-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.74);
}

.cashier-journal-inline-item.tone-success {
  background: rgba(240, 253, 244, 0.92);
  border-color: rgba(21, 128, 61, 0.16);
}

.cashier-journal-inline-item.tone-warning {
  background: rgba(255, 251, 235, 0.92);
  border-color: rgba(180, 83, 9, 0.2);
}

.cashier-journal-inline-item.tone-danger {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.18);
}

.cashier-journal-empty {
  padding: 16px;
  border-radius: 18px;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
}

@media (max-width: 760px) {
  .cashier-journal-scan-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cashier-journal-panel-head,
  .cashier-journal-inline-item {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
