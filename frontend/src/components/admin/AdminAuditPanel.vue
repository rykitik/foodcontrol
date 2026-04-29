<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import { formatAdminDateTime, formatAuditActionLabel, formatAuditDetailsSummary, formatAuditEntityLabel } from '@/utils/adminPresentation'
import type { AuditLogEntry } from '@/types'

const props = defineProps<{
  totalActions: number
  activeUsers: number
  latestEntry: AuditLogEntry | null
  entries: AuditLogEntry[]
}>()

defineEmits<{
  (event: 'open-full'): void
}>()

const metricCards = computed(() => [
  {
    label: 'Событий за сегодня',
    value: String(props.totalActions),
    icon: 'reports' as const,
  },
  {
    label: 'Пользователей в журнале',
    value: String(props.activeUsers),
    icon: 'students' as const,
  },
  {
    label: 'Последняя запись',
    value: props.latestEntry ? formatAdminDateTime(props.latestEntry.created_at) : '—',
    icon: 'clock' as const,
  },
])
</script>

<template>
  <section class="admin-panel-card">
    <header class="admin-panel-card__header">
      <div>
        <h2>Аудит действий</h2>
        <p>Быстрый контроль последних операций без перехода на отдельную страницу журнала.</p>
      </div>
      <p-button label="Открыть полный аудит" severity="secondary" outlined @click="$emit('open-full')">
        <template #icon>
          <AppIcon name="open" />
        </template>
      </p-button>
    </header>

    <div class="admin-audit-metrics">
      <article v-for="card in metricCards" :key="card.label" class="admin-audit-metric">
        <span class="admin-audit-metric__icon" aria-hidden="true">
          <AppIcon :name="card.icon" />
        </span>
        <span class="admin-audit-metric__copy">
          <strong>{{ card.value }}</strong>
          <small>{{ card.label }}</small>
        </span>
      </article>
    </div>

    <div v-if="entries.length" class="admin-audit-list">
      <article v-for="entry in entries" :key="entry.id" class="admin-audit-entry">
        <div class="admin-audit-entry__main">
          <strong>{{ formatAuditActionLabel(entry.action) }}</strong>
          <p>{{ entry.user_name }} · {{ formatAuditEntityLabel(entry.entity_type) }}</p>
        </div>
        <div class="admin-audit-entry__details">
          <span>{{ formatAuditDetailsSummary(entry.details) }}</span>
          <time :datetime="entry.created_at">{{ formatAdminDateTime(entry.created_at) }}</time>
        </div>
      </article>
    </div>

    <div v-else class="admin-panel-card__empty">
      <AppIcon name="reports" />
      <p>Журнал пока пуст. Новые действия пользователей появятся здесь автоматически.</p>
    </div>
  </section>
</template>

<style scoped>
.admin-panel-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #fff;
}

.admin-panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.admin-panel-card__header h2,
.admin-panel-card__header p {
  margin: 0;
}

.admin-panel-card__header h2 {
  color: #07172f;
  font-size: 22px;
}

.admin-panel-card__header p {
  margin-top: 6px;
  color: #5c6a82;
}

.admin-audit-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.admin-audit-metric {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 86px;
  padding: 16px;
  border: 1px solid #e2eaf4;
  border-radius: 12px;
  background: #f8fbff;
}

.admin-audit-metric__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: #eef5ff;
  color: #0866ff;
}

.admin-audit-metric__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-audit-metric__copy strong {
  font-size: 20px;
  line-height: 1;
}

.admin-audit-metric__copy small {
  color: #5c6a82;
  font-size: 13px;
}

.admin-audit-list {
  display: flex;
  flex-direction: column;
  border: 1px solid #e2eaf4;
  border-radius: 12px;
  overflow: hidden;
}

.admin-audit-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  background: #fff;
}

.admin-audit-entry + .admin-audit-entry {
  border-top: 1px solid #eef2f7;
}

.admin-audit-entry__main strong,
.admin-audit-entry__main p,
.admin-audit-entry__details span,
.admin-audit-entry__details time {
  display: block;
}

.admin-audit-entry__main strong {
  color: #07172f;
  font-size: 15px;
}

.admin-audit-entry__main p {
  margin: 4px 0 0;
  color: #5c6a82;
}

.admin-audit-entry__details {
  min-width: 280px;
  text-align: right;
}

.admin-audit-entry__details span {
  color: #40506a;
  font-size: 13px;
}

.admin-audit-entry__details time {
  margin-top: 6px;
  color: #7a879d;
  font-size: 13px;
}

.admin-panel-card__empty {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: 18px;
  border: 1px dashed #d6dfeb;
  border-radius: 12px;
  color: #5c6a82;
  background: #fbfdff;
}

.admin-panel-card__empty p {
  margin: 0;
}

@media (max-width: 960px) {
  .admin-panel-card__header,
  .admin-audit-entry {
    flex-direction: column;
    align-items: stretch;
  }

  .admin-audit-metrics {
    grid-template-columns: 1fr;
  }

  .admin-audit-entry__details {
    min-width: 0;
    text-align: left;
  }
}
</style>
