<script setup lang="ts">
import { buildCategoryMealLabel, type CategoryDraft } from '@/utils/categorySettings'
import type { Category } from '@/types'

defineProps<{
  categories: Category[]
  drafts: Record<number, CategoryDraft>
  loading?: boolean
}>()

defineEmits<{
  save: [category: Category]
  archive: [category: Category]
}>()
</script>

<template>
  <div class="category-table-wrap">
    <table class="category-table">
      <colgroup>
        <col class="col-category" />
        <col class="col-toggle" />
        <col class="col-price" />
        <col class="col-toggle" />
        <col class="col-price" />
        <col class="col-comment" />
        <col class="col-summary" />
        <col class="col-actions" />
      </colgroup>
      <thead>
        <tr>
          <th>Категория</th>
          <th>Завтрак</th>
          <th>Цена завтрака</th>
          <th>Обед</th>
          <th>Цена обеда</th>
          <th>Комментарий</th>
          <th>Итог</th>
          <th class="actions-col">Действие</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!categories.length">
          <td colspan="8" class="empty-cell">Категории не найдены</td>
        </tr>
        <tr v-for="category in categories" :key="category.id">
          <td class="category-cell">
            <p-input-text v-model="drafts[category.id]!.name" aria-label="Название категории" />
            <p-input-text
              v-model="drafts[category.id]!.code"
              aria-label="Код категории"
              placeholder="technical_code"
            />
          </td>
          <td>
            <div class="toggle-cell">
              <p-checkbox v-model="drafts[category.id]!.breakfast" binary :input-id="`breakfast-${category.id}`" />
              <label :for="`breakfast-${category.id}`">Да</label>
            </div>
          </td>
          <td>
            <p-input-number
              v-model="drafts[category.id]!.breakfast_price"
              :min="0"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              mode="decimal"
              :disabled="!drafts[category.id]!.breakfast"
            />
          </td>
          <td>
            <div class="toggle-cell">
              <p-checkbox v-model="drafts[category.id]!.lunch" binary :input-id="`lunch-${category.id}`" />
              <label :for="`lunch-${category.id}`">Да</label>
            </div>
          </td>
          <td>
            <p-input-number
              v-model="drafts[category.id]!.lunch_price"
              :min="0"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              mode="decimal"
              :disabled="!drafts[category.id]!.lunch"
            />
          </td>
          <td>
            <p-textarea v-model="drafts[category.id]!.description" rows="2" auto-resize />
          </td>
          <td class="summary-cell">
            {{ buildCategoryMealLabel(drafts[category.id]!) }}
          </td>
          <td class="actions-col">
            <div class="row-actions">
              <p-button label="Сохранить" size="small" :loading="loading" @click="$emit('save', category)" />
              <p-button
                label="Удалить"
                severity="danger"
                outlined
                size="small"
                :disabled="loading || categories.length <= 1"
                @click="$emit('archive', category)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.category-table-wrap {
  overflow-x: auto;
  border: 1px solid #dbe5f0;
  border-radius: 20px;
  background: #fff;
}

.category-table {
  width: 100%;
  min-width: 1260px;
  border-collapse: collapse;
  table-layout: fixed;
}

.category-table th,
.category-table td {
  padding: 18px 22px;
  border-bottom: 1px solid #e9eff7;
  vertical-align: middle;
  text-align: left;
}

.category-table tbody tr:last-child td {
  border-bottom: 0;
}

.category-table th {
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  background: #fff;
}

.category-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 84px;
}

.category-cell strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 22px;
}

.category-cell span {
  color: #475569;
  font-size: 14px;
  line-height: 20px;
}

.toggle-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.summary-cell {
  color: #0f172a;
  font-weight: 600;
}

.actions-col {
  width: 250px;
}

.col-category {
  width: 210px;
}

.col-toggle {
  width: 110px;
}

.col-price {
  width: 160px;
}

.col-comment {
  width: 260px;
}

.col-summary {
  width: 250px;
}

.col-actions {
  width: 250px;
}

.row-actions {
  display: grid;
  gap: 8px;
}

:deep(.p-inputnumber),
:deep(.p-inputtext),
:deep(.p-textarea) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: block;
}

:deep(.p-inputnumber-input),
:deep(.p-inputtext),
:deep(.p-inputtextarea) {
  width: 100%;
  min-width: 0;
  border-radius: 12px;
  border-color: #dbe3ee;
  box-shadow: none;
}

.empty-cell {
  padding: 32px 24px;
  text-align: center;
  color: #64748b;
}
</style>
