<script setup lang="ts">
import { computed } from 'vue'

import type { CashierSummaryMonthOption } from '@/composables/useCashierSummary'
import type { CashierDailySummary } from '@/types'
import {
  formatCashierSummaryMonth,
  formatCashierSummaryPeriod,
} from '@/utils/cashierSummaryPresentation'

type FilterMode = 'today' | 'month'

const props = defineProps<{
  filterMode: FilterMode
  loading: boolean
  monthOptions: CashierSummaryMonthOption[]
  selectedMonthValue: string
  summary: CashierDailySummary | null
}>()

const emit = defineEmits<{
  (event: 'download-xlsx'): void
  (event: 'refresh'): void
  (event: 'select-month', value: string): void
  (event: 'show-month'): void
  (event: 'show-today'): void
}>()

const loadedFilterLabel = computed(() => {
  if (!props.summary) {
    return 'Сегодня'
  }

  if (props.summary.filter.mode === 'month' && props.summary.filter.month && props.summary.filter.year) {
    return formatCashierSummaryMonth(props.summary.filter.month, props.summary.filter.year)
  }

  return 'Сегодня'
})

const loadedPeriodLabel = computed(() => {
  if (!props.summary) {
    return 'Период загружается'
  }

  return formatCashierSummaryPeriod(props.summary.period_start, props.summary.period_end)
})

function handleMonthChange(value: string | undefined) {
  if (!value) {
    return
  }

  emit('select-month', value)
}
</script>

<template>
  <section class="cashier-summary-toolbar">
    <div class="cashier-summary-toolbar-mode" role="tablist" aria-label="Фильтр периода">
      <button
        type="button"
        class="cashier-summary-mode-button"
        :class="{ active: filterMode === 'today' }"
        :disabled="loading"
        @click="emit('show-today')"
      >
        Сегодня
      </button>
      <button
        type="button"
        class="cashier-summary-mode-button"
        :class="{ active: filterMode === 'month' }"
        :disabled="loading"
        @click="emit('show-month')"
      >
        Месяц
      </button>
    </div>

    <div class="cashier-summary-toolbar-center">
      <label v-if="filterMode === 'month'" class="cashier-summary-month-picker">
        <span class="cashier-summary-toolbar-label">Месяц</span>
        <PDropdown
          :model-value="selectedMonthValue"
          :options="monthOptions"
          option-label="label"
          option-value="value"
          class="cashier-summary-month-dropdown"
          :disabled="loading"
          @update:model-value="handleMonthChange"
        />
      </label>

      <div class="cashier-summary-toolbar-status">
        <span class="cashier-summary-toolbar-label">Показано</span>
        <strong>{{ loadedFilterLabel }}</strong>
        <span>{{ loadedPeriodLabel }}</span>
      </div>
    </div>

    <div class="cashier-summary-toolbar-actions">
      <button type="button" class="cashier-summary-action" :disabled="loading" @click="emit('refresh')">
        {{ loading ? 'Обновляем...' : 'Обновить' }}
      </button>
      <button
        type="button"
        class="cashier-summary-action primary"
        :disabled="!summary"
        @click="emit('download-xlsx')"
      >
        Скачать Excel
      </button>
    </div>
  </section>
</template>

<style scoped>
.cashier-summary-toolbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
}

.cashier-summary-toolbar-mode {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.cashier-summary-mode-button,
.cashier-summary-action {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.94);
  color: var(--text);
  font: inherit;
  font-weight: 700;
}

.cashier-summary-mode-button {
  min-width: 112px;
  border-color: transparent;
  background: transparent;
}

.cashier-summary-mode-button.active {
  background: rgba(15, 23, 42, 0.96);
  color: white;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
}

.cashier-summary-toolbar-center {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex-wrap: wrap;
}

.cashier-summary-month-picker,
.cashier-summary-toolbar-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cashier-summary-month-picker {
  flex: 0 0 220px;
}

.cashier-summary-toolbar-status {
  min-width: 0;
}

.cashier-summary-toolbar-status strong {
  color: var(--text);
  font-size: 1rem;
  line-height: 1.1;
}

.cashier-summary-toolbar-status span:last-child {
  color: var(--muted);
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cashier-summary-toolbar-label {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cashier-summary-toolbar-actions {
  display: inline-flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cashier-summary-action.primary {
  background: rgba(15, 23, 42, 0.96);
  color: white;
}

.cashier-summary-action:disabled,
.cashier-summary-mode-button:disabled {
  cursor: default;
  opacity: 0.58;
}

.cashier-summary-month-dropdown {
  width: 100%;
}

:deep(.cashier-summary-month-dropdown.p-dropdown) {
  width: 100%;
  min-height: 42px;
  border-radius: 14px;
  border-color: rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.96);
}

:deep(.cashier-summary-month-dropdown .p-dropdown-label) {
  padding: 10px 14px;
  color: var(--text);
  font-weight: 700;
}

:deep(.cashier-summary-month-dropdown .p-dropdown-trigger) {
  width: 42px;
}

@media (max-width: 1080px) {
  .cashier-summary-toolbar {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .cashier-summary-toolbar-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .cashier-summary-toolbar-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .cashier-summary-month-picker {
    flex-basis: 100%;
  }

  .cashier-summary-toolbar-status span:last-child {
    white-space: normal;
  }
}
</style>
