<script setup lang="ts">
defineProps<{
  action: string
  entityType: string
  actor: string
  ipAddress: string
  dateFrom: string
  dateTo: string
  limit: number
  actionOptions: Array<{ label: string; value: string }>
  entityOptions: Array<{ label: string; value: string }>
  limitOptions: number[]
  loading: boolean
}>()

const emit = defineEmits<{
  'update:action': [value: string]
  'update:entityType': [value: string]
  'update:actor': [value: string]
  'update:ipAddress': [value: string]
  'update:dateFrom': [value: string]
  'update:dateTo': [value: string]
  'update:limit': [value: number]
  apply: []
  reset: []
  refresh: []
}>()

function emitDateFrom(event: Event) {
  emit('update:dateFrom', (event.target as HTMLInputElement).value)
}

function emitDateTo(event: Event) {
  emit('update:dateTo', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="audit-filters">
    <header class="audit-filters__header">
      <div>
        <h2>Фильтры аудита</h2>
        <p>Ограничьте выборку по типу события, периоду, IP и участнику операции.</p>
      </div>
      <div class="audit-filters__actions">
        <p-button label="Обновить" severity="secondary" outlined :loading="loading" @click="emit('refresh')" />
        <p-button label="Сбросить" severity="secondary" text @click="emit('reset')" />
        <p-button label="Применить" :loading="loading" @click="emit('apply')" />
      </div>
    </header>

    <div class="audit-filters__grid">
      <label class="field">
        <span>Действие</span>
        <p-dropdown :model-value="action" :options="actionOptions" option-label="label" option-value="value" @update:model-value="emit('update:action', $event)" />
      </label>
      <label class="field">
        <span>Сущность</span>
        <p-dropdown :model-value="entityType" :options="entityOptions" option-label="label" option-value="value" @update:model-value="emit('update:entityType', $event)" />
      </label>
      <label class="field">
        <span>Участник / логин</span>
        <p-input-text :model-value="actor" placeholder="ФИО, логин или системная запись" @update:model-value="emit('update:actor', String($event))" />
      </label>
      <label class="field">
        <span>IP-адрес</span>
        <p-input-text :model-value="ipAddress" placeholder="Например, 172.20." @update:model-value="emit('update:ipAddress', String($event))" />
      </label>
      <label class="field">
        <span>Дата от</span>
        <input class="audit-date-input" type="date" :value="dateFrom" @input="emitDateFrom" />
      </label>
      <label class="field">
        <span>Дата до</span>
        <input class="audit-date-input" type="date" :value="dateTo" @input="emitDateTo" />
      </label>
      <label class="field">
        <span>Лимит загрузки</span>
        <p-dropdown :model-value="limit" :options="limitOptions" @update:model-value="emit('update:limit', Number($event))" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.audit-filters {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #fff;
}

.audit-filters__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.audit-filters__header h2,
.audit-filters__header p {
  margin: 0;
}

.audit-filters__header h2 {
  color: #07172f;
  font-size: 22px;
}

.audit-filters__header p {
  margin-top: 6px;
  color: #5c6a82;
}

.audit-filters__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.audit-filters__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.audit-date-input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid #cfd8e3;
  border-radius: 10px;
  background: #fff;
  color: #07172f;
  font: inherit;
}

@media (max-width: 1180px) {
  .audit-filters__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .audit-filters__header,
  .audit-filters__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .audit-filters__grid {
    grid-template-columns: 1fr;
  }
}
</style>
