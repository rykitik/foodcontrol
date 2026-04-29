<script setup lang="ts">
import { computed } from 'vue'

import type { TicketBulkPreviewResponse } from '@/types'
import type { TicketPeriodType } from '@/composables/useTicketPeriod'

const props = defineProps<{
  visible: boolean
  selectedCount: number
  monthLabel: string
  periodType: TicketPeriodType
  startDate: string
  endDate: string
  startDateMin?: string
  endDateMax?: string
  preview: TicketBulkPreviewResponse | null
  loading?: boolean
  submitting?: boolean
  errorMessage?: string
  validationMessage?: string
}>()

const emit = defineEmits<{
  close: []
  submit: []
  updatePeriodType: [value: TicketPeriodType]
  updateStartDate: [value: string]
  updateEndDate: [value: string]
}>()

const canSubmit = computed(() => {
  if (props.loading || props.submitting) {
    return false
  }
  if (props.validationMessage || props.errorMessage) {
    return false
  }
  return Boolean(props.preview && props.preview.total_ticket_count > 0)
})

const periodOptions: Array<{ value: TicketPeriodType; label: string }> = [
  { value: 'month', label: 'Весь месяц' },
  { value: 'partial', label: 'Часть месяца' },
  { value: 'range', label: 'Произвольный период' },
]
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="issue-panel-layer" @click.self="emit('close')">
      <aside class="issue-panel" aria-label="Выдача талонов">
        <header class="issue-panel-header">
          <div>
            <h2>Выдача талонов</h2>
            <p>{{ selectedCount }} {{ selectedCount === 1 ? 'студент' : 'студентов' }}</p>
          </div>
          <button type="button" class="panel-close" @click="emit('close')">Закрыть</button>
        </header>

        <section class="issue-section">
          <h3>Период</h3>
          <div class="period-switcher" role="radiogroup" aria-label="Тип периода">
            <button
              v-for="option in periodOptions"
              :key="option.value"
              type="button"
              :class="['period-option', { active: option.value === periodType }]"
              :aria-pressed="option.value === periodType"
              @click="emit('updatePeriodType', option.value)"
            >
              {{ option.label }}
            </button>
          </div>

          <p v-if="periodType === 'month'" class="month-note">Текущий месяц: {{ monthLabel }}</p>

          <div v-else class="date-grid">
            <label class="date-field">
              <span>Дата начала</span>
              <input
                :value="startDate"
                :min="startDateMin"
                :max="periodType === 'partial' ? endDateMax : undefined"
                type="date"
                @input="emit('updateStartDate', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="date-field">
              <span>Дата окончания</span>
              <input
                :value="endDate"
                :min="startDate || startDateMin"
                :max="periodType === 'partial' ? endDateMax : undefined"
                type="date"
                @input="emit('updateEndDate', ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>

          <div class="hint-block">
            Если период пересекает несколько месяцев, система автоматически создаст отдельные талоны по каждому месяцу.
          </div>
        </section>

        <section class="issue-section">
          <h3>Предпросмотр</h3>

          <div v-if="validationMessage" class="warning-block warning-block--soft">
            {{ validationMessage }}
          </div>

          <div v-else-if="errorMessage" class="warning-block warning-block--soft">
            {{ errorMessage }}
          </div>

          <div v-else-if="loading" class="preview-block preview-block--muted">
            Готовим предпросмотр выдачи...
          </div>

          <div v-else-if="preview" class="preview-stack">
            <div class="preview-block">
              <div class="preview-row">
                <span>Студенты</span>
                <strong>{{ preview.issueable_student_count }} из {{ preview.selected_student_count }}</strong>
              </div>
              <div class="preview-row">
                <span>Будет создано талонов</span>
                <strong>{{ preview.total_ticket_count }}</strong>
              </div>
            </div>

            <div class="preview-block">
              <strong class="preview-title">Разбивка по месяцам</strong>
              <div v-for="month in preview.month_breakdown" :key="`${month.year}-${month.month}`" class="preview-row">
                <span>{{ month.label }}</span>
                <strong>{{ month.ticket_count }}</strong>
              </div>
            </div>

            <div v-if="preview.warnings.length" class="warning-block">
              <strong>Предупреждения</strong>
              <p v-for="warning in preview.warnings" :key="warning.code" class="warning-line">
                {{ warning.message }}
              </p>
            </div>
          </div>
        </section>

        <footer class="issue-panel-footer">
          <p-button label="Отмена" severity="secondary" text :disabled="submitting" @click="emit('close')" />
          <p-button label="Выдать талоны" :disabled="!canSubmit" :loading="submitting" @click="emit('submit')" />
        </footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.issue-panel-layer {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.28);
}

.issue-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(420px, 100vw);
  height: 100vh;
  padding: 20px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -16px 0 40px rgba(15, 23, 42, 0.12);
}

.issue-panel-header,
.issue-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.issue-panel-header h2,
.issue-section h3,
.issue-panel-header p,
.preview-row,
.warning-line {
  margin: 0;
}

.issue-panel-header h2 {
  font-size: 20px;
  line-height: 28px;
  color: #111827;
}

.issue-panel-header p {
  margin-top: 4px;
  color: #6b7280;
  font-size: 14px;
  line-height: 20px;
}

.panel-close {
  border: 0;
  background: transparent;
  color: #6b7280;
  font: inherit;
  cursor: pointer;
}

.issue-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.issue-section h3 {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: #111827;
}

.period-switcher {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.period-option {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font: inherit;
  cursor: pointer;
}

.period-option.active {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #1d4ed8;
}

.month-note {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-field span {
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.date-field input {
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font: inherit;
  color: #111827;
}

.hint-block,
.preview-block,
.warning-block {
  padding: 12px;
  border-radius: 8px;
}

.hint-block,
.preview-block {
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.preview-block--muted {
  color: #6b7280;
}

.preview-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-title {
  display: block;
  margin-bottom: 8px;
  color: #111827;
  font-size: 14px;
  line-height: 20px;
}

.preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  line-height: 20px;
}

.warning-block {
  border: 1px solid #fcd34d;
  background: #fef3c7;
  color: #92400e;
}

.warning-block--soft {
  border-color: #fed7aa;
  background: #fff7ed;
}

.warning-block strong {
  display: block;
  margin-bottom: 8px;
}

.issue-panel-footer {
  margin-top: auto;
  padding-top: 4px;
}

@media (max-width: 720px) {
  .issue-panel {
    width: 100vw;
  }

  .period-switcher,
  .date-grid {
    grid-template-columns: 1fr;
  }
}
</style>
