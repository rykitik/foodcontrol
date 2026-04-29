<script setup lang="ts">
import CategoryBooleanChip from '@/components/categories/CategoryBooleanChip.vue'
import type { Category } from '@/types'
import { buildCategoryMealSummaryParts, createCategoryDraft, formatCategoryPrice, resolveCategoryPrice } from '@/utils/categorySettings'

const props = defineProps<{
  categories: Category[]
}>()

function breakfastPriceLabel(category: Category) {
  if (!category.breakfast) {
    return '—'
  }

  return formatCategoryPrice(resolveCategoryPrice(category, 'breakfast'))
}

function lunchPriceLabel(category: Category) {
  if (!category.lunch) {
    return '—'
  }

  return formatCategoryPrice(resolveCategoryPrice(category, 'lunch'))
}

function summaryLines(category: Category) {
  return buildCategoryMealSummaryParts(createCategoryDraft(category))
}
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
        </tr>
      </thead>
      <tbody>
        <tr v-if="!props.categories.length">
          <td colspan="7" class="empty-cell">Категории не найдены</td>
        </tr>
        <tr v-for="category in props.categories" :key="category.id">
          <td class="category-cell">
            <strong>{{ category.name }}</strong>
            <span>{{ category.code }}</span>
          </td>
          <td><CategoryBooleanChip :active="category.breakfast" /></td>
          <td class="price-cell">{{ breakfastPriceLabel(category) }}</td>
          <td><CategoryBooleanChip :active="category.lunch" /></td>
          <td class="price-cell">{{ lunchPriceLabel(category) }}</td>
          <td class="comment-cell">
            <span>{{ category.description || '—' }}</span>
          </td>
          <td class="summary-cell">
            <div v-if="summaryLines(category).length" class="summary-lines">
              <strong v-for="line in summaryLines(category)" :key="line">{{ line }}</strong>
            </div>
            <span v-else class="summary-empty">Без питания</span>
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
  min-width: 1120px;
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
  min-height: 96px;
}

.category-cell strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 22px;
}

.category-cell span {
  color: #334155;
  font-size: 14px;
  line-height: 20px;
}

.price-cell,
.comment-cell,
.summary-cell {
  color: #0f172a;
  font-size: 15px;
  line-height: 22px;
}

.price-cell {
  font-weight: 500;
}

.comment-cell span {
  color: #0f172a;
}

.summary-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-lines strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
}

.summary-empty {
  color: #64748b;
}

.col-category {
  width: 184px;
}

.col-toggle {
  width: 110px;
}

.col-price {
  width: 160px;
}

.col-comment {
  width: 225px;
}

.col-summary {
  width: 250px;
}

.empty-cell {
  padding: 32px 24px;
  text-align: center;
  color: #64748b;
}
</style>
