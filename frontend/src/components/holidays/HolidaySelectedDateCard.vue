<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { HolidayEditForm, HolidaySelectedDateMeta } from '@/types'
import {
  buildSelectedDatePresentation,
  holidayReasonOptions,
} from '@/utils/holidayCalendarPresentation'

const props = defineProps<{
  form: HolidayEditForm
  selectedDate: string
  selectedDateMeta: HolidaySelectedDateMeta
  canEdit: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  save: []
  remove: []
}>()

const presentation = computed(() =>
  buildSelectedDatePresentation(props.selectedDate, props.selectedDateMeta, props.canEdit),
)
</script>

<template>
  <section class="holiday-side-card" aria-label="Выбранная дата">
    <div class="holiday-side-card-head">
      <h2>Выбранная дата</h2>
    </div>

    <div class="holiday-date-summary">
      <div class="holiday-date-title">
        <span class="holiday-date-icon" aria-hidden="true">
          <AppIcon name="calendar" />
        </span>
        <div>
          <strong>{{ presentation.dateLabel }}</strong>
          <span>({{ presentation.weekdayLabel }})</span>
        </div>
      </div>

      <div class="holiday-date-status">
        <span class="holiday-status-chip" :class="`holiday-status-chip--${presentation.cellState}`">
          {{ presentation.statusLabel }}
        </span>
        <p>{{ presentation.statusText }}</p>
      </div>
    </div>

    <dl
      v-if="presentation.reasonLabel || presentation.sourceLabel || presentation.comment"
      class="holiday-meta-list"
    >
      <div v-if="presentation.reasonLabel" class="holiday-meta-row">
        <dt>Причина</dt>
        <dd>{{ presentation.reasonLabel }}</dd>
      </div>
      <div v-if="presentation.sourceLabel" class="holiday-meta-row">
        <dt>Источник</dt>
        <dd>{{ presentation.sourceLabel }}</dd>
      </div>
      <div v-if="presentation.comment" class="holiday-meta-row">
        <dt>Комментарий</dt>
        <dd>{{ presentation.comment }}</dd>
      </div>
    </dl>

    <p v-if="presentation.infoMessage" class="holiday-info-note">{{ presentation.infoMessage }}</p>

    <template v-if="presentation.canEditForm">
      <div class="holiday-side-divider" />

      <div class="holiday-form-grid">
        <label class="field">
          <span>Дата</span>
          <p-input-text v-model="form.holiday_date" type="date" :disabled="loading" />
        </label>

        <label class="field">
          <span>Тип причины</span>
          <p-dropdown
            v-model="form.reason_type"
            :options="holidayReasonOptions"
            option-label="label"
            option-value="value"
            :disabled="loading"
            placeholder="Выберите тип причины"
          />
        </label>
      </div>

      <label class="field">
        <span>Название / комментарий</span>
        <p-input-text
          v-model="form.comment"
          :disabled="loading"
          placeholder="Например, санитарная обработка пищеблока"
        />
      </label>

      <div class="toggle-row holiday-toggle-row">
        <p-checkbox v-model="form.is_active" binary input-id="holiday-single-active" :disabled="loading" />
        <label for="holiday-single-active">Питание не выдается в этот день</label>
      </div>

      <div class="holiday-action-row">
        <p-button label="Сохранить" :loading="loading" @click="emit('save')" />
        <p-button
          v-if="presentation.canDelete"
          label="Удалить"
          severity="danger"
          outlined
          :disabled="loading"
          @click="emit('remove')"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.holiday-side-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  border: 1px solid #dbe5f0;
  border-radius: 18px;
  background: #fff;
}

.holiday-side-card-head h2 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 28px;
}

.holiday-date-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.holiday-date-title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.holiday-date-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: #eff6ff;
  color: #2563eb;
}

.holiday-date-title strong,
.holiday-date-title span,
.holiday-date-status p {
  display: block;
  margin: 0;
}

.holiday-date-title strong {
  color: #0f172a;
  font-size: 18px;
  line-height: 24px;
}

.holiday-date-title span,
.holiday-date-status p,
.holiday-info-note,
.holiday-meta-row dt,
.holiday-meta-row dd {
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.holiday-date-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.holiday-status-chip {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid #dbe5f0;
  background: #fff;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.holiday-status-chip--automatic {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.holiday-status-chip--manual {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.holiday-status-chip--inactive {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #64748b;
}

.holiday-meta-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.holiday-meta-row {
  display: grid;
  grid-template-columns: minmax(110px, 0.45fr) minmax(0, 1fr);
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid #eef2f7;
}

.holiday-meta-row dt,
.holiday-meta-row dd {
  margin: 0;
}

.holiday-meta-row dd {
  color: #0f172a;
  font-weight: 500;
}

.holiday-info-note {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid #dbe5f0;
  border-radius: 14px;
  background: #f8fafc;
}

.holiday-side-divider {
  height: 1px;
  background: #e8eef5;
}

.holiday-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.holiday-toggle-row {
  margin-top: -4px;
}

.holiday-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 720px) {
  .holiday-form-grid,
  .holiday-meta-row {
    grid-template-columns: 1fr;
  }
}
</style>
