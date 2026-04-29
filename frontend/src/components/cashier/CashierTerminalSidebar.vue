<script setup lang="ts">
import { mealTypeLabels } from '@/config/options'
import type { MealType } from '@/types'

defineProps<{
  remainingMeals: MealType[]
  selectedMeals: MealType[]
  loading: boolean
  showManualControls: boolean
}>()

defineEmits<{
  toggleMeal: [mealType: MealType]
  confirm: []
}>()
</script>

<template>
  <aside class="cashier-terminal-side">
    <section v-if="showManualControls" class="terminal-panel terminal-actions-panel">
      <span>Выдача</span>
      <div class="terminal-action-grid">
        <button
          type="button"
          class="terminal-action-button"
          :disabled="!remainingMeals.includes('breakfast')"
          @click="$emit('toggleMeal', 'breakfast')"
        >
          {{ mealTypeLabels.breakfast }}
        </button>
        <button
          type="button"
          class="terminal-action-button"
          :disabled="!remainingMeals.includes('lunch')"
          @click="$emit('toggleMeal', 'lunch')"
        >
          {{ mealTypeLabels.lunch }}
        </button>
        <button
          type="button"
          class="terminal-action-button confirm"
          :disabled="!selectedMeals.length || loading"
          @click="$emit('confirm')"
        >
          Подтвердить
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.cashier-terminal-side {
  display: block;
}

.terminal-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow);
}

.terminal-panel strong {
  color: var(--text);
}

.terminal-panel span {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.terminal-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.terminal-action-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  min-height: 72px;
  padding: 14px 18px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.96);
  color: white;
  font-size: 1.05rem;
  font-weight: 800;
}

.terminal-action-button.confirm {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #15803d, #22c55e);
}

.terminal-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 1180px) {
  .cashier-terminal-side {
    display: block;
  }
}
</style>
