<script setup lang="ts">
import { computed } from 'vue'

import type { CashierJournalOfflineState } from '@/types'
import {
  currentIsoDate,
  formatCashierJournalDate,
  formatCashierJournalDateTime,
} from '@/utils/cashierJournalPresentation'

const props = defineProps<{
  offlineState: CashierJournalOfflineState
}>()

type StatusTone = 'info' | 'success' | 'warning' | 'danger'

const terminalInfo = computed(() => {
  const displayName = props.offlineState.terminal_display_name?.trim()
  if (!displayName) {
    return null
  }

  const separator = ' terminal @ '
  const separatorIndex = displayName.indexOf(separator)
  if (separatorIndex < 0) {
    return {
      title: displayName,
      host: null,
    }
  }

  const title = displayName.slice(0, separatorIndex).trim() || displayName
  const host = displayName.slice(separatorIndex + separator.length).trim() || null
  return { title, host }
})

const connectionTone = computed<StatusTone>(() => (props.offlineState.is_online ? 'success' : 'warning'))
const connectionLabel = computed(() =>
  props.offlineState.is_online ? 'Интернет доступен' : 'Терминал работает без сети',
)

const snapshotTone = computed<StatusTone>(() => {
  if (!props.offlineState.has_partition) {
    return 'danger'
  }

  if (!props.offlineState.snapshot_ready || !props.offlineState.service_date) {
    return 'warning'
  }

  if (props.offlineState.service_date !== currentIsoDate()) {
    return 'warning'
  }

  return 'success'
})

const snapshotLabel = computed(() => {
  if (!props.offlineState.has_partition) {
    return 'Оффлайн не подготовлен'
  }

  if (!props.offlineState.snapshot_ready) {
    return 'Резервный снимок не загружен'
  }

  if (!props.offlineState.service_date) {
    return 'Резерв загружен, но без даты обслуживания'
  }

  if (props.offlineState.service_date !== currentIsoDate()) {
    return `Резерв на ${formatCashierJournalDate(props.offlineState.service_date)}`
  }

  return 'Резервный снимок актуален'
})

const datasetLabel = computed(() =>
  `${props.offlineState.snapshot_students_count} студентов, ${props.offlineState.snapshot_tickets_count} талонов, ${props.offlineState.snapshot_categories_count} категорий`,
)

const summaryCards = computed(() => [
  {
    key: 'connection',
    label: 'Связь',
    value: connectionLabel.value,
    tone: connectionTone.value,
  },
  {
    key: 'queue',
    label: 'Оффлайн-очередь',
    value: String(props.offlineState.queue_count),
    tone: props.offlineState.queue_count > 0 ? 'info' : 'success',
  },
  {
    key: 'review',
    label: 'Ручная проверка',
    value: String(props.offlineState.review_count),
    tone: props.offlineState.review_count > 0 ? 'warning' : 'success',
  },
])
</script>

<template>
  <section class="cashier-journal-panel">
    <header class="cashier-journal-panel-head">
      <div>
        <p class="eyebrow">Резервный режим</p>
        <h2>Оффлайн-подготовка кассы</h2>
      </div>
      <span class="cashier-journal-status" :class="`tone-${snapshotTone}`">{{ snapshotLabel }}</span>
    </header>

    <div class="cashier-journal-summary-grid">
      <article
        v-for="card in summaryCards"
        :key="card.key"
        class="cashier-journal-summary-card"
        :class="`tone-${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </div>

    <dl class="cashier-journal-meta-list">
      <div v-if="terminalInfo" class="cashier-journal-meta-row">
        <dt>Терминал</dt>
        <dd>
          <span>{{ terminalInfo.title }}</span>
          <small v-if="terminalInfo.host">{{ terminalInfo.host }}</small>
        </dd>
      </div>
      <div class="cashier-journal-meta-row">
        <dt>Снимок сформирован</dt>
        <dd>{{ formatCashierJournalDateTime(offlineState.generated_at) }}</dd>
      </div>
      <div class="cashier-journal-meta-row">
        <dt>Дата обслуживания</dt>
        <dd>
          {{
            offlineState.service_date
              ? formatCashierJournalDate(offlineState.service_date)
              : 'Не сохранена'
          }}
        </dd>
      </div>
      <div class="cashier-journal-meta-row">
        <dt>Резервные данные</dt>
        <dd>{{ datasetLabel }}</dd>
      </div>
    </dl>

    <div class="cashier-journal-notes">
      <p>Оффлайн-очередь хранится только на этом терминале до восстановления сети.</p>
      <p>Поиск и выдача должны работать только по корпусу питания студента.</p>
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

.cashier-journal-status {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
}

.cashier-journal-status.tone-success {
  color: #166534;
  background: rgba(240, 253, 244, 0.92);
}

.cashier-journal-status.tone-warning {
  color: #92400e;
  background: rgba(255, 251, 235, 0.92);
}

.cashier-journal-status.tone-danger {
  color: #991b1b;
  background: rgba(254, 242, 242, 0.92);
}

.cashier-journal-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.cashier-journal-summary-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.cashier-journal-summary-card span {
  margin: 0;
  color: var(--muted);
}

.cashier-journal-summary-card strong {
  color: var(--text);
}

.cashier-journal-summary-card.tone-info {
  background: rgba(239, 246, 255, 0.92);
  border-color: rgba(37, 99, 235, 0.18);
}

.cashier-journal-summary-card.tone-success {
  background: rgba(240, 253, 244, 0.92);
  border-color: rgba(21, 128, 61, 0.16);
}

.cashier-journal-summary-card.tone-warning {
  background: rgba(255, 251, 235, 0.92);
  border-color: rgba(180, 83, 9, 0.2);
}

.cashier-journal-meta-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.cashier-journal-meta-row {
  display: grid;
  grid-template-columns: minmax(150px, 180px) minmax(0, 1fr);
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.cashier-journal-meta-row dt,
.cashier-journal-meta-row dd,
.cashier-journal-notes p {
  margin: 0;
}

.cashier-journal-meta-row dt {
  color: var(--muted);
  font-weight: 600;
}

.cashier-journal-meta-row dd {
  display: grid;
  gap: 4px;
  color: var(--text);
}

.cashier-journal-meta-row small {
  color: var(--muted);
}

.cashier-journal-notes {
  display: grid;
  gap: 8px;
}

.cashier-journal-notes p {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(239, 246, 255, 0.9);
  color: #1d4ed8;
  font-weight: 600;
}

@media (max-width: 760px) {
  .cashier-journal-panel-head {
    flex-direction: column;
    align-items: stretch;
  }

  .cashier-journal-summary-grid,
  .cashier-journal-meta-row {
    grid-template-columns: 1fr;
  }
}
</style>
