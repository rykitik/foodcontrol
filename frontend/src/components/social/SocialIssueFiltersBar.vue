<script setup lang="ts">
import SocialOutlineIcon from '@/components/social/SocialOutlineIcon.vue'
import type { Category } from '@/types'

defineProps<{
  periodKey: string
  periodOptions: Array<{ label: string; value: string }>
  categoryId: number | null
  categories: Category[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:periodKey': [value: string]
  'update:categoryId': [value: number | null]
  refresh: []
  useCurrentPeriod: []
}>()
</script>

<template>
  <section class="issue-filters" aria-label="Фильтры печати">
    <label class="issue-filter-field">
      <span class="issue-filter-label">Период</span>
      <div class="issue-filter-control issue-filter-control--icon">
        <span class="issue-filter-icon">
          <SocialOutlineIcon name="calendar" />
        </span>
        <p-dropdown
          :model-value="periodKey"
          :options="periodOptions"
          option-label="label"
          option-value="value"
          append-to="body"
          @update:model-value="emit('update:periodKey', String($event ?? ''))"
        />
      </div>
    </label>

    <label class="issue-filter-field">
      <span class="issue-filter-label">Категория студентов</span>
      <div class="issue-filter-control issue-filter-control--icon">
        <span class="issue-filter-icon">
          <SocialOutlineIcon name="student" />
        </span>
        <p-dropdown
          :model-value="categoryId"
          :options="[{ id: null, name: 'Все категории' }, ...categories]"
          option-label="name"
          option-value="id"
          append-to="body"
          @update:model-value="emit('update:categoryId', ($event as number | null) ?? null)"
        />
      </div>
    </label>

    <div class="issue-filter-actions">
      <button
        type="button"
        class="issue-filter-button issue-filter-button--secondary"
        :disabled="loading"
        @click="emit('useCurrentPeriod')"
      >
        <SocialOutlineIcon name="calendar" />
        <span>Текущий период</span>
      </button>

      <button type="button" class="issue-filter-button issue-filter-button--secondary" :disabled="loading" @click="emit('refresh')">
        <SocialOutlineIcon name="refresh" />
        <span>Обновить</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.issue-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
}

.issue-filter-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.issue-filter-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.issue-filter-control {
  min-width: 0;
}

.issue-filter-control--icon {
  position: relative;
}

.issue-filter-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  z-index: 1;
  color: #475569;
  transform: translateY(-50%);
  pointer-events: none;
}

.issue-filter-control :deep(.p-dropdown) {
  width: 100%;
}

.issue-filter-control :deep(.p-dropdown-label),
.issue-filter-control :deep(.p-select-label) {
  min-height: 48px;
  padding: 13px 14px 13px 46px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.issue-filter-control :deep(.p-dropdown) {
  border-radius: 12px;
  border-color: #dbe3ee;
  box-shadow: none;
}

.issue-filter-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid #dbe3ee;
  background: #fff;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}

.issue-filter-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.issue-filter-actions {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 12px;
}

.issue-filter-button--secondary:hover:not(:disabled) {
  background: #f8fafc;
}

@media (max-width: 1180px) {
  .issue-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .issue-filter-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 680px) {
  .issue-filters {
    grid-template-columns: 1fr;
    padding: 14px;
    gap: 12px;
  }

  .issue-filter-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .issue-filter-button {
    width: 100%;
  }
}
</style>
