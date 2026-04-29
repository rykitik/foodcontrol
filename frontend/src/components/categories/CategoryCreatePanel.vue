<script setup lang="ts">
import { buildCategoryMealLabel, type CategoryDraft } from '@/utils/categorySettings'

defineProps<{
  draft: CategoryDraft
  loading?: boolean
}>()

defineEmits<{
  create: []
  cancel: []
}>()
</script>

<template>
  <section class="category-create-panel" aria-label="Новая категория питания">
    <div class="category-create-panel__head">
      <div>
        <h2>Новая категория</h2>
        <p>Код можно указать вручную или оставить пустым для автоматического создания.</p>
      </div>
      <p-button label="Отмена" severity="secondary" outlined size="small" :disabled="loading" @click="$emit('cancel')" />
    </div>

    <div class="category-create-grid">
      <label class="category-create-field category-create-field--name">
        <span>Название</span>
        <p-input-text v-model="draft.name" placeholder="Например, СВО" :disabled="loading" />
      </label>

      <label class="category-create-field">
        <span>Код</span>
        <p-input-text v-model="draft.code" placeholder="svo" :disabled="loading" />
      </label>

      <label class="category-create-check">
        <span>Завтрак</span>
        <span class="category-create-check__control">
          <p-checkbox v-model="draft.breakfast" binary input-id="new-category-breakfast" :disabled="loading" />
          <span>Да</span>
        </span>
      </label>

      <label class="category-create-field">
        <span>Цена завтрака</span>
        <p-input-number
          v-model="draft.breakfast_price"
          :min="0"
          :min-fraction-digits="2"
          :max-fraction-digits="2"
          mode="decimal"
          :disabled="loading || !draft.breakfast"
        />
      </label>

      <label class="category-create-check">
        <span>Обед</span>
        <span class="category-create-check__control">
          <p-checkbox v-model="draft.lunch" binary input-id="new-category-lunch" :disabled="loading" />
          <span>Да</span>
        </span>
      </label>

      <label class="category-create-field">
        <span>Цена обеда</span>
        <p-input-number
          v-model="draft.lunch_price"
          :min="0"
          :min-fraction-digits="2"
          :max-fraction-digits="2"
          mode="decimal"
          :disabled="loading || !draft.lunch"
        />
      </label>

      <label class="category-create-field category-create-field--comment">
        <span>Комментарий</span>
        <p-textarea v-model="draft.description" rows="2" auto-resize :disabled="loading" />
      </label>

      <div class="category-create-summary">
        <span>Итог</span>
        <strong>{{ buildCategoryMealLabel(draft) }}</strong>
      </div>

      <div class="category-create-actions">
        <p-button label="Создать категорию" :loading="loading" @click="$emit('create')" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.category-create-panel {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid #dbe5f0;
  border-radius: 20px;
  background: #fff;
}

.category-create-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.category-create-panel h2 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  line-height: 24px;
}

.category-create-panel p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 18px;
}

.category-create-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) 140px 120px 160px 120px 160px minmax(220px, 1.4fr) minmax(160px, 1fr) 170px;
  gap: 14px;
  align-items: end;
}

.category-create-field,
.category-create-check,
.category-create-summary {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.category-create-field span,
.category-create-check > span:first-child,
.category-create-summary span {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}

.category-create-check__control {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  gap: 8px;
}

.category-create-summary strong {
  min-height: 42px;
  display: flex;
  align-items: center;
  color: #0f172a;
  font-size: 14px;
  line-height: 18px;
}

.category-create-actions {
  display: flex;
  justify-content: flex-end;
}

:deep(.p-inputtext),
:deep(.p-inputnumber),
:deep(.p-textarea) {
  width: 100%;
  min-width: 0;
}

:deep(.p-inputtext),
:deep(.p-inputnumber-input),
:deep(.p-inputtextarea) {
  border-radius: 12px;
  border-color: #dbe3ee;
  box-shadow: none;
}

@media (max-width: 1280px) {
  .category-create-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .category-create-field--name,
  .category-create-field--comment,
  .category-create-summary,
  .category-create-actions {
    grid-column: 1 / -1;
  }

  .category-create-actions {
    justify-content: flex-start;
  }
}
</style>
