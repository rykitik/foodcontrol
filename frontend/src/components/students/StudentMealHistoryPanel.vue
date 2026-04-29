<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import StudentMealRecordInspector from '@/components/students/StudentMealRecordInspector.vue'
import { mealTypeFilterOptions, mealTypeLabels } from '@/config/options'
import type { MealRecord, MealType } from '@/types'
import { formatStudentCurrency, formatStudentDate } from '@/utils/studentDetailPresentation'

const props = defineProps<{
  history: MealRecord[]
  loading: boolean
  error: string
  historyFilter: {
    period_start: string
    period_end: string
    meal_type: MealType | 'all'
  }
}>()

const emit = defineEmits<{
  refresh: []
  reset: []
}>()

const selectedRecordId = ref<string | null>(null)

const totalAmount = computed(() => props.history.reduce((sum, record) => sum + record.price, 0))
const breakfastCount = computed(() => props.history.filter((record) => record.meal_type === 'breakfast').length)
const lunchCount = computed(() => props.history.filter((record) => record.meal_type === 'lunch').length)
const totalMeals = computed(() => breakfastCount.value + lunchCount.value)
const balanceSummaryLabel = computed(() =>
  totalMeals.value ? `Завтраки: ${breakfastCount.value} · Обеды: ${lunchCount.value}` : 'Нет выдач',
)
const breakfastWidth = computed(() => (totalMeals.value ? (breakfastCount.value / totalMeals.value) * 100 : 0))
const lunchWidth = computed(() => (totalMeals.value ? (lunchCount.value / totalMeals.value) * 100 : 0))
const selectedRecord = computed(() => props.history.find((record) => record.id === selectedRecordId.value) ?? null)

function resolveSelectedRecordId(records: MealRecord[], currentSelection: string | null): string | null {
  if (records.length === 0) {
    return null
  }

  if (currentSelection && records.some((record) => record.id === currentSelection)) {
    return currentSelection
  }

  return records[0]?.id ?? null
}

function selectRecord(recordId: string) {
  selectedRecordId.value = recordId
}

watch(
  () => props.history,
  (records) => {
    selectedRecordId.value = resolveSelectedRecordId(records, selectedRecordId.value)
  },
  { immediate: true },
)
</script>

<template>
  <p-card class="content-card student-history-panel">
    <template #title>Журнал питания</template>

    <template #content>
      <div class="student-history-panel__toolbar">
        <div class="student-history-panel__filters form-grid">
          <label class="field">
            <span>Дата с</span>
            <p-input-text v-model="historyFilter.period_start" type="date" />
          </label>

          <label class="field">
            <span>Дата по</span>
            <p-input-text v-model="historyFilter.period_end" type="date" />
          </label>

          <label class="field">
            <span>Тип питания</span>
            <p-dropdown
              v-model="historyFilter.meal_type"
              :options="mealTypeFilterOptions"
              option-label="label"
              option-value="value"
            />
          </label>
        </div>

        <div class="student-history-panel__actions">
          <p-button label="Показать журнал" :loading="loading" @click="emit('refresh')" />
          <p-button label="Сбросить фильтр" severity="secondary" outlined :disabled="loading" @click="emit('reset')" />
        </div>
      </div>

      <div class="student-history-panel__summary-grid">
        <article class="student-history-panel__summary-card">
          <span>Выдач в выборке</span>
          <strong>{{ history.length }}</strong>
        </article>

        <article class="student-history-panel__summary-card">
          <span>Сумма за период</span>
          <strong>{{ formatStudentCurrency(totalAmount) }}</strong>
        </article>

        <article class="student-history-panel__summary-card student-history-panel__summary-card--balance">
          <div class="student-history-panel__summary-head">
            <span>Баланс питания</span>
            <strong>{{ balanceSummaryLabel }}</strong>
          </div>

          <svg class="student-history-panel__balance-chart" viewBox="0 0 100 12" aria-hidden="true">
            <rect x="0" y="0" width="100" height="12" rx="6" fill="rgba(148, 163, 184, 0.18)" />
            <rect v-if="breakfastWidth" x="0" y="0" :width="breakfastWidth" height="12" rx="6" fill="#2563eb" />
            <rect v-if="lunchWidth" :x="breakfastWidth" y="0" :width="lunchWidth" height="12" rx="6" fill="#3b82f6" opacity="0.35" />
          </svg>
        </article>
      </div>

      <p v-if="error && history.length" class="student-history-panel__error">{{ error }}</p>

      <div v-if="loading && !history.length" class="student-history-state">
        <strong>Загружаем журнал питания...</strong>
      </div>

      <div v-else-if="error && !history.length" class="student-history-state student-history-state--error">
        <strong>{{ error }}</strong>
      </div>

      <div v-else-if="history.length" class="student-history-panel__workspace">
        <section class="student-history-register" aria-label="Реестр выдач">
          <div class="student-history-list-head">
            <span>Дата и время</span>
            <span>Питание</span>
            <span>Оформил</span>
            <span>Сумма</span>
          </div>

          <div class="student-history-list" role="listbox" aria-label="Записи журнала питания">
            <button
              v-for="record in history"
              :key="record.id"
              type="button"
              class="student-history-row"
              :class="{ 'student-history-row--selected': record.id === selectedRecordId }"
              :aria-selected="record.id === selectedRecordId"
              @click="selectRecord(record.id)"
            >
              <span class="student-history-row__date" data-label="Дата и время">
                <strong>{{ formatStudentDate(record.issue_date) }}</strong>
                <small>{{ record.issue_time }}</small>
              </span>

              <span class="student-history-row__meal" data-label="Питание">
                <strong>{{ mealTypeLabels[record.meal_type] }}</strong>
                <small>{{ record.category_name }}</small>
              </span>

              <span class="student-history-row__issuer" data-label="Оформил">{{ record.issued_by_name }}</span>

              <span class="student-history-row__amount" data-label="Сумма">{{ formatStudentCurrency(record.price) }}</span>
            </button>
          </div>
        </section>

        <StudentMealRecordInspector :record="selectedRecord" />
      </div>

      <div v-else class="student-history-state">
        <strong>Записей нет.</strong>
      </div>
    </template>
  </p-card>
</template>

<style scoped>
.student-history-panel :deep(.p-card-body) {
  gap: var(--student-detail-space-4, 20px);
}

.student-history-panel__toolbar,
.student-history-panel__summary-card,
.student-history-state {
  display: flex;
  flex-direction: column;
}

.student-history-panel__toolbar {
  gap: 16px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid #dbe3ee;
  background: #fff;
}

.student-history-panel__filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.student-history-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.student-history-panel__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.student-history-panel__summary-card {
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid #dbe3ee;
  background: #fff;
}

.student-history-panel__summary-card span {
  color: #64748b;
}

.student-history-panel__summary-card strong,
.student-history-state strong {
  color: #0f172a;
}

.student-history-panel__summary-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.student-history-panel__summary-card--balance {
  gap: 14px;
}

.student-history-panel__balance-chart {
  width: 100%;
  height: 12px;
}

.student-history-panel__error {
  margin: 0;
  color: #b91c1c;
}

.student-history-panel__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.95fr);
  gap: 16px;
  align-items: start;
}

.student-history-register {
  border: 1px solid #dbe3ee;
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
}

.student-history-list-head,
.student-history-row {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr) minmax(0, 1.08fr) auto;
  gap: 16px;
  align-items: center;
}

.student-history-list-head {
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.student-history-list-head span {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 700;
}

.student-history-list {
  display: flex;
  flex-direction: column;
}

.student-history-row {
  width: 100%;
  padding: 16px 18px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
  text-align: left;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.student-history-row:last-child {
  border-bottom: 0;
}

.student-history-row:hover,
.student-history-row:focus-visible {
  background: #f8fafc;
}

.student-history-row--selected {
  background: #eff6ff;
  box-shadow: inset 4px 0 0 #2563eb;
}

.student-history-row__date,
.student-history-row__meal {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.student-history-row__date strong,
.student-history-row__meal strong,
.student-history-row__issuer,
.student-history-row__amount {
  color: #0f172a;
  font-weight: 700;
}

.student-history-row__date small,
.student-history-row__meal small {
  color: #64748b;
}

.student-history-row__amount {
  white-space: nowrap;
}

.student-history-state {
  gap: 12px;
  padding: 20px;
  border-radius: 18px;
  border: 1px dashed #cbd5e1;
  background: #fff;
}

.student-history-state--error {
  border-style: solid;
  border-color: rgba(185, 28, 28, 0.24);
  background: rgba(254, 242, 242, 0.96);
}

@media (max-width: 1080px) {
  .student-history-panel__workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .student-history-panel__filters,
  .student-history-panel__summary-grid,
  .student-history-list-head,
  .student-history-row {
    grid-template-columns: 1fr;
  }

  .student-history-list-head {
    display: none;
  }

  .student-history-row__date::before,
  .student-history-row__meal::before,
  .student-history-row__issuer::before,
  .student-history-row__amount::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 4px;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 700;
  }
}
</style>
