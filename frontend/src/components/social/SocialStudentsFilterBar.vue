<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import { studentStatusFilterOptions } from '@/config/studentFilters'
import { monthOptions } from '@/config/options'
import type { Category, StudentStatusFilter } from '@/types'

const props = defineProps<{
  search: string
  month: number
  year: number
  categoryId: number | null
  studentStatusFilter: StudentStatusFilter
  categories: Category[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:month': [value: number]
  'update:year': [value: number]
  'update:categoryId': [value: number | null]
  'update:studentStatusFilter': [value: StudentStatusFilter]
  submitSearch: []
  refresh: []
}>()

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  const start = Math.min(currentYear - 1, props.year - 1)
  const end = Math.max(currentYear + 3, props.year + 1)

  return Array.from({ length: end - start + 1 }, (_, index) => {
    const value = start + index
    return { label: String(value), value }
  })
})
</script>

<template>
  <section class="students-filter-bar" aria-label="Фильтры студентов">
    <label class="filter-field filter-field--search">
      <span class="filter-label">Поиск</span>
      <span class="search-field">
        <p-input-text
          :model-value="search"
          placeholder="ФИО, группа или код"
          class="filter-input"
          @update:model-value="emit('update:search', String($event ?? ''))"
          @keydown.enter.prevent="emit('submitSearch')"
        />
        <AppIcon name="search" class="search-icon" />
      </span>
    </label>

    <label class="filter-field">
      <span class="filter-label">Месяц</span>
      <p-dropdown
        :model-value="month"
        :options="monthOptions"
        option-label="label"
        option-value="value"
        class="filter-select"
        @update:model-value="emit('update:month', Number($event))"
      />
    </label>

    <label class="filter-field">
      <span class="filter-label">Год</span>
      <p-dropdown
        :model-value="year"
        :options="yearOptions"
        option-label="label"
        option-value="value"
        class="filter-select filter-select--year"
        @update:model-value="emit('update:year', Number($event))"
      />
    </label>

    <label class="filter-field">
      <span class="filter-label">Категория</span>
      <p-dropdown
        :model-value="categoryId"
        :options="[{ id: null, name: 'Все категории' }, ...categories]"
        option-label="name"
        option-value="id"
        class="filter-select"
        @update:model-value="emit('update:categoryId', ($event as number | null) ?? null)"
      />
    </label>

    <label class="filter-field">
      <span class="filter-label">Статус талона</span>
      <p-dropdown
        :model-value="studentStatusFilter"
        :options="studentStatusFilterOptions"
        option-label="label"
        option-value="value"
        class="filter-select"
        @update:model-value="emit('update:studentStatusFilter', $event as StudentStatusFilter)"
      />
    </label>

    <div class="filter-actions">
      <p-button
        label="Обновить"
        severity="secondary"
        outlined
        :loading="loading"
        @click="emit('refresh')"
      />
    </div>
  </section>
</template>

<style scoped>
.students-filter-bar {
  display: grid;
  grid-template-columns: minmax(240px, 1.3fr) repeat(4, minmax(132px, 0.72fr)) auto;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.filter-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.search-field {
  position: relative;
  display: block;
}

.filter-input,
.filter-select {
  width: 100%;
}

.filter-input :deep(.p-inputtext),
.filter-select :deep(.p-dropdown) {
  width: 100%;
  min-height: 40px;
  border-radius: 10px;
  border-color: #dbe3ee;
  background: #fff;
  box-shadow: none;
}

.filter-input :deep(.p-inputtext) {
  padding-right: 40px;
}

.filter-select :deep(.p-dropdown-label) {
  padding: 9px 12px;
  font-size: 14px;
}

.search-icon {
  position: absolute;
  top: 50%;
  right: 12px;
  width: 18px;
  height: 18px;
  color: #94a3b8;
  transform: translateY(-50%);
  pointer-events: none;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.filter-actions :deep(.p-button) {
  min-height: 40px;
  padding-inline: 16px;
  border-radius: 10px;
}

@media (max-width: 1320px) {
  .students-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .students-filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .students-filter-bar {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: stretch;
  }

  .filter-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
