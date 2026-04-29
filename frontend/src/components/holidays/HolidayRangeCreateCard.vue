<script setup lang="ts">
import { computed } from 'vue'

import type { HolidayEntry, HolidayRangeForm } from '@/types'
import {
  buildHolidayRangePreview,
  holidayReasonOptions,
} from '@/utils/holidayCalendarPresentation'

const props = defineProps<{
  canEdit: boolean
  form: HolidayRangeForm
  allHolidays: HolidayEntry[]
  loading: boolean
}>()

const emit = defineEmits<{
  save: []
}>()

const preview = computed(() => buildHolidayRangePreview(props.form, props.allHolidays))
</script>

<template>
  <section class="holiday-side-card" aria-label="Добавить период">
    <h2>Добавить период</h2>

    <template v-if="canEdit">
      <div class="holiday-range-grid">
        <label class="field">
          <span>Дата с</span>
          <p-input-text v-model="form.start_date" type="date" :disabled="loading" />
        </label>

        <label class="field">
          <span>Дата по</span>
          <p-input-text v-model="form.end_date" type="date" :disabled="loading" />
        </label>
      </div>

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

      <label class="field">
        <span>Название / комментарий</span>
        <p-input-text
          v-model="form.comment"
          :disabled="loading"
          placeholder="Например, весенние каникулы"
        />
      </label>

      <div class="toggle-row holiday-toggle-row">
        <p-checkbox v-model="form.is_active" binary input-id="holiday-range-active" :disabled="loading" />
        <label for="holiday-range-active">Питание не выдается в выбранный период</label>
      </div>

      <div class="holiday-range-preview">
        <p>Будет добавлено: {{ preview.createdCount }} {{ preview.createdCount === 1 ? 'день' : 'дней' }}</p>
        <p v-if="preview.skippedCount">Уже существует и будет пропущено: {{ preview.skippedCount }}</p>
      </div>

      <div class="holiday-range-action">
        <p-button label="Добавить период" :loading="loading" @click="emit('save')" />
      </div>

      <p class="holiday-range-note">
        Существующие заблокированные даты будут пропущены. Воскресенья блокируются автоматически.
      </p>
    </template>

    <p v-else class="holiday-range-note holiday-range-note--readonly">
      Для вашей роли доступен только просмотр календаря.
    </p>
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

.holiday-side-card h2 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 28px;
}

.holiday-range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.holiday-toggle-row {
  margin-top: -4px;
}

.holiday-range-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #dbe5f0;
  border-radius: 14px;
  background: #f8fbff;
}

.holiday-range-preview p,
.holiday-range-note {
  margin: 0;
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.holiday-range-preview p:first-child {
  color: #0f172a;
  font-weight: 600;
}

.holiday-range-action {
  display: flex;
  justify-content: flex-start;
}

.holiday-range-note--readonly {
  padding: 14px 16px;
  border-radius: 14px;
  background: #f8fafc;
}

@media (max-width: 720px) {
  .holiday-range-grid {
    grid-template-columns: 1fr;
  }
}
</style>
