<script setup lang="ts">
import { mealTypeLabels } from '@/config/options'
import type { MealType } from '@/types'

defineProps<{
  lookupStatuses: Array<{
    meal_type: MealType
    issued: boolean
    price: number
  }>
  selectedMeals: MealType[]
  remainingMeals: MealType[]
}>()

defineEmits<{
  toggleMeal: [mealType: MealType]
}>()
</script>

<template>
  <div class="terminal-meal-grid">
    <button
      v-for="status in lookupStatuses"
      :key="status.meal_type"
      type="button"
      class="terminal-meal-card"
      :class="{
        issued: status.issued,
        available: !status.issued,
        selected: selectedMeals.includes(status.meal_type),
      }"
      :disabled="status.issued || !remainingMeals.includes(status.meal_type)"
      @click="$emit('toggleMeal', status.meal_type)"
    >
      <span>{{ mealTypeLabels[status.meal_type] }}</span>
      <strong>
        {{
          status.issued
            ? 'Уже выдан'
            : selectedMeals.includes(status.meal_type)
              ? 'Выбран'
              : 'Доступен'
        }}
      </strong>
      <small>{{ status.price.toFixed(2) }} ₽</small>
    </button>
  </div>
</template>

<style scoped>
.terminal-meal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.terminal-meal-card {
  border: 0;
  cursor: pointer;
  font: inherit;
  display: grid;
  gap: 8px;
  min-height: 120px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  border: 2px solid transparent;
  text-align: center;
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.terminal-meal-card.available {
  border-color: rgba(21, 128, 61, 0.2);
}

.terminal-meal-card.issued {
  background: rgba(254, 242, 242, 0.92);
  border-color: rgba(220, 38, 38, 0.18);
  cursor: not-allowed;
}

.terminal-meal-card.selected {
  border-color: rgba(29, 78, 216, 0.42);
  box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.12);
}

.terminal-meal-card span {
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-meal-card strong {
  color: var(--text);
  font-size: clamp(1.2rem, 1.8vw, 1.66rem);
}

.terminal-meal-card small {
  color: var(--muted);
  font-size: 1rem;
}

.terminal-meal-card:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}
</style>
