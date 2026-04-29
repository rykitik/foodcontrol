<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'

const props = defineProps<{
  month: number
  year: number
  includeInactive: boolean
  monthOptions: Array<{ label: string; value: number }>
  yearOptions: Array<{ label: string; value: number }>
}>()

const emit = defineEmits<{
  shift: [offset: number]
  'update:month': [value: number]
  'update:year': [value: number]
  'update:includeInactive': [value: boolean]
}>()

const monthModel = computed({
  get: () => props.month,
  set: (value: number) => emit('update:month', value),
})

const yearModel = computed({
  get: () => props.year,
  set: (value: number) => emit('update:year', value),
})

const includeInactiveModel = computed({
  get: () => props.includeInactive,
  set: (value: boolean) => emit('update:includeInactive', value),
})
</script>

<template>
  <section class="holiday-toolbar-card" aria-label="Выбор периода календаря">
    <div class="holiday-toolbar-main">
      <div class="holiday-toolbar-nav">
        <p-button
          severity="secondary"
          outlined
          rounded
          class="holiday-toolbar-nav-button"
          aria-label="Предыдущий месяц"
          @click="emit('shift', -1)"
        >
          <AppIcon name="chevronLeft" />
        </p-button>
        <p-button
          severity="secondary"
          outlined
          rounded
          class="holiday-toolbar-nav-button"
          aria-label="Следующий месяц"
          @click="emit('shift', 1)"
        >
          <AppIcon name="chevronRight" />
        </p-button>
      </div>

      <div class="holiday-toolbar-fields">
        <p-dropdown
          v-model="monthModel"
          class="holiday-toolbar-select holiday-toolbar-select--month"
          :options="monthOptions"
          option-label="label"
          option-value="value"
        />

        <p-dropdown
          v-model="yearModel"
          class="holiday-toolbar-select holiday-toolbar-select--year"
          :options="yearOptions"
          option-label="label"
          option-value="value"
        />
      </div>
    </div>

    <div class="holiday-toolbar-toggle">
      <p-checkbox v-model="includeInactiveModel" binary input-id="holiday-include-inactive" />
      <label for="holiday-include-inactive">Показывать неактивные даты в календаре и списке</label>
    </div>
  </section>
</template>

<style scoped>
.holiday-toolbar-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid #dbe5f0;
  border-radius: 18px;
  background: #fff;
}

.holiday-toolbar-main {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.holiday-toolbar-nav {
  display: flex;
  gap: 8px;
}

.holiday-toolbar-nav-button {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
}

.holiday-toolbar-fields {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(120px, 150px);
  gap: 12px;
}

.holiday-toolbar-select {
  min-width: 0;
}

.holiday-toolbar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding-left: 8px;
  min-height: 40px;
}

.holiday-toolbar-toggle label {
  color: #1e293b;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

@media (max-width: 1220px) {
  .holiday-toolbar-card {
    grid-template-columns: 1fr;
  }

  .holiday-toolbar-toggle {
    padding-left: 0;
  }
}

@media (max-width: 760px) {
  .holiday-toolbar-main,
  .holiday-toolbar-fields {
    grid-template-columns: 1fr;
  }

  .holiday-toolbar-nav {
    justify-content: flex-start;
  }
}
</style>
