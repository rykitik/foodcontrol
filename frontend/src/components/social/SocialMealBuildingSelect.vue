<script setup lang="ts">
import { computed } from 'vue'

import { mealBuildingOptions } from '@/config/options'
import type { Student, StudentUpdateRequest } from '@/types'

type MealBuildingValue = number | 'all'

const props = defineProps<{
  student: Student
  busy?: boolean
  disabled?: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{
  save: [request: Pick<StudentUpdateRequest, 'meal_building_id' | 'allow_all_meal_buildings'>]
}>()

const compactOptions = mealBuildingOptions.map((option) => ({
  ...option,
  ariaLabel: option.value === 'all' ? option.label : `Корпус ${option.shortLabel}`,
}))

const selectedValue = computed<MealBuildingValue>(() => {
  if (props.student.allow_all_meal_buildings) {
    return 'all'
  }

  return props.student.effective_meal_building_id ?? props.student.building_id
})

const selectedLabel = computed(() => compactOptions.find((option) => option.value === selectedValue.value)?.label ?? '')

function handleChange(nextValue: MealBuildingValue) {
  if (nextValue === selectedValue.value) {
    return
  }

  if (nextValue === 'all') {
    emit('save', {
      meal_building_id: null,
      allow_all_meal_buildings: true,
    })
    return
  }

  emit('save', {
    meal_building_id: nextValue === props.student.building_id ? null : nextValue,
    allow_all_meal_buildings: false,
  })
}
</script>

<template>
  <div
    class="meal-building-switch"
    :class="{
      'meal-building-switch--disabled': disabled,
      'meal-building-switch--busy': busy,
    }"
    :title="disabled ? disabledReason : selectedLabel"
  >
    <button
      v-for="option in compactOptions"
      :key="`${student.id}-${option.value}`"
      type="button"
      :class="[
        'meal-building-switch__button',
        {
          'meal-building-switch__button--active': option.value === selectedValue,
          'meal-building-switch__button--all': option.value === 'all',
        },
      ]"
      :disabled="disabled || busy"
      :title="option.label"
      :aria-label="option.ariaLabel"
      @click="handleChange(option.value)"
    >
      {{ option.shortLabel }}
    </button>
  </div>
</template>

<style scoped>
.meal-building-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.meal-building-switch__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.meal-building-switch__button--all {
  width: 36px;
}

.meal-building-switch__button:hover:not(:disabled) {
  border-color: #94a3b8;
  color: #0f172a;
  transform: translateY(-1px);
}

.meal-building-switch__button--active {
  border-color: #16a34a;
  background: #16a34a;
  color: #fff;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
}

.meal-building-switch--busy .meal-building-switch__button--active {
  background: #15803d;
}

.meal-building-switch__button:disabled {
  cursor: not-allowed;
}

.meal-building-switch--disabled .meal-building-switch__button,
.meal-building-switch--busy .meal-building-switch__button {
  opacity: 0.7;
}
</style>
