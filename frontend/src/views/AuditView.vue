<script setup lang="ts">
import AuditFiltersPanel from '@/components/audit/AuditFiltersPanel.vue'
import AuditLogTable from '@/components/audit/AuditLogTable.vue'
import AuditSummaryCards from '@/components/audit/AuditSummaryCards.vue'
import { useAuditWorkspace } from '@/composables/useAuditWorkspace'

const workspace = useAuditWorkspace()
</script>

<template>
  <section class="page-stack audit-page">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Журнал действий</p>
        <h1>Аудит операций и событий системы</h1>
        <p class="audit-copy">Фильтрация спорных действий, ручных правок и операций по студентам, талонам и отчетам.</p>
      </div>
      <div class="heading-actions">
        <p-button :label="workspace.backLabel.value" severity="secondary" outlined @click="workspace.goBack" />
      </div>
    </div>

    <AuditSummaryCards
      :filtered-count="workspace.filteredCount.value"
      :loaded-count="workspace.loadedCount.value"
      :today-count="workspace.todayCount.value"
      :unique-actors-count="workspace.uniqueActorsCount.value"
      :attention-count="workspace.attentionCount.value"
    />

    <AuditFiltersPanel
      :action="workspace.filters.action"
      :entity-type="workspace.filters.entityType"
      :actor="workspace.filters.actor"
      :ip-address="workspace.filters.ipAddress"
      :date-from="workspace.filters.dateFrom"
      :date-to="workspace.filters.dateTo"
      :limit="workspace.filters.limit"
      :action-options="workspace.actionOptions.value"
      :entity-options="workspace.entityOptions.value"
      :limit-options="workspace.limitOptions"
      :loading="workspace.loading.value"
      @update:action="workspace.filters.action = $event"
      @update:entity-type="workspace.filters.entityType = $event"
      @update:actor="workspace.filters.actor = $event"
      @update:ip-address="workspace.filters.ipAddress = $event"
      @update:date-from="workspace.filters.dateFrom = $event"
      @update:date-to="workspace.filters.dateTo = $event"
      @update:limit="workspace.filters.limit = $event"
      @apply="workspace.applyFilters"
      @reset="workspace.resetFilters"
      @refresh="workspace.refresh"
    />

    <AuditLogTable
      :entries="workspace.filteredLogs.value"
      :loading="workspace.loading.value"
      :error="workspace.error.value"
    />
  </section>
</template>

<style scoped>
.audit-page {
  gap: 16px;
}

.audit-copy {
  margin: 8px 0 0;
  max-width: 760px;
  color: var(--muted);
}

.heading-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
</style>
