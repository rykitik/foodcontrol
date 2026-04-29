<script setup lang="ts">
import { ref } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { AuditLogEntry } from '@/types'
import {
  formatAdminDateTime,
  formatAuditActionLabel,
  formatAuditDetailsList,
  formatAuditDetailsSummary,
  formatAuditEntityLabel,
  isAuditAttentionAction,
} from '@/utils/adminPresentation'

defineProps<{
  entries: AuditLogEntry[]
  loading: boolean
  error?: string
}>()

const expandedIds = ref<number[]>([])

function toggleExpanded(entryId: number) {
  expandedIds.value = expandedIds.value.includes(entryId)
    ? expandedIds.value.filter((id) => id !== entryId)
    : [...expandedIds.value, entryId]
}

function isExpanded(entryId: number) {
  return expandedIds.value.includes(entryId)
}
</script>

<template>
  <section class="audit-table">
    <header class="audit-table__header">
      <div>
        <h2>Лента событий</h2>
        <p>Разворачивайте строки для подробностей по изменению, экспорту или попытке входа.</p>
      </div>
    </header>

    <div v-if="loading" class="audit-table__empty">Загружаем журнал...</div>
    <div v-else-if="error" class="audit-table__empty audit-table__empty-error">{{ error }}</div>
    <div v-else-if="entries.length" class="audit-table__rows">
      <article v-for="entry in entries" :key="entry.id" class="audit-row" :class="{ attention: isAuditAttentionAction(entry.action) }">
        <div class="audit-row__main">
          <div class="audit-row__time">
            <strong>{{ formatAdminDateTime(entry.created_at) }}</strong>
            <span>{{ entry.ip_address || 'IP не указан' }}</span>
          </div>

          <div class="audit-row__event">
            <div class="audit-row__event-head">
              <span v-if="isAuditAttentionAction(entry.action)" class="audit-row__marker">
                <AppIcon name="alertTriangle" />
              </span>
              <strong>{{ formatAuditActionLabel(entry.action) }}</strong>
            </div>
            <p>{{ entry.user_name }} · {{ formatAuditEntityLabel(entry.entity_type) }}</p>
            <span>{{ formatAuditDetailsSummary(entry.details) }}</span>
          </div>

          <button type="button" class="audit-row__toggle" @click="toggleExpanded(entry.id)">
            {{ isExpanded(entry.id) ? 'Скрыть' : 'Подробнее' }}
          </button>
        </div>

        <dl v-if="isExpanded(entry.id)" class="audit-row__details">
          <template v-for="item in formatAuditDetailsList(entry.details)" :key="`${entry.id}-${item.label}`">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </template>
          <template v-if="entry.user_agent">
            <dt>Браузер / клиент</dt>
            <dd>{{ entry.user_agent }}</dd>
          </template>
        </dl>
      </article>
    </div>
    <div v-else class="audit-table__empty">По выбранным фильтрам событий нет.</div>
  </section>
</template>

<style scoped>
.audit-table {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #fff;
}

.audit-table__header h2,
.audit-table__header p {
  margin: 0;
}

.audit-table__header h2 {
  color: #07172f;
  font-size: 22px;
}

.audit-table__header p {
  margin-top: 6px;
  color: #5c6a82;
}

.audit-table__rows {
  display: flex;
  flex-direction: column;
  border: 1px solid #e2eaf4;
  border-radius: 12px;
  overflow: hidden;
}

.audit-row {
  background: #fff;
}

.audit-row + .audit-row {
  border-top: 1px solid #eef2f7;
}

.audit-row.attention {
  background: #fffaf5;
}

.audit-row__main {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
  padding: 18px;
}

.audit-row__time strong,
.audit-row__time span,
.audit-row__event p,
.audit-row__event span {
  display: block;
}

.audit-row__time strong,
.audit-row__event strong {
  color: #07172f;
}

.audit-row__time span,
.audit-row__event p,
.audit-row__event span {
  margin-top: 5px;
  color: #5c6a82;
}

.audit-row__event-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audit-row__marker {
  display: inline-flex;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  color: #f97316;
}

.audit-row__toggle {
  min-width: 104px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #dce5f1;
  border-radius: 10px;
  background: #fff;
  color: #40506a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.audit-row__details {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 10px 16px;
  margin: 0;
  padding: 0 18px 18px;
}

.audit-row__details dt {
  color: #5c6a82;
  font-weight: 700;
}

.audit-row__details dd {
  margin: 0;
  color: #07172f;
  word-break: break-word;
}

.audit-table__empty {
  padding: 18px;
  border: 1px dashed #d6dfeb;
  border-radius: 12px;
  color: #5c6a82;
  background: #fbfdff;
}

.audit-table__empty-error {
  color: #b42318;
  background: #fff5f5;
  border-color: #f3d1d1;
}

@media (max-width: 960px) {
  .audit-row__main {
    grid-template-columns: 1fr;
  }

  .audit-row__details {
    grid-template-columns: 1fr;
  }
}
</style>
