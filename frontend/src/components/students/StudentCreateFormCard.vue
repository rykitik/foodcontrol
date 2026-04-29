<script setup lang="ts">
import StudentCreateFormFields from '@/components/students/StudentCreateFormFields.vue'
import type { Category, StudentCreateRequest } from '@/types'

const props = withDefaults(
  defineProps<{
    categories: Category[]
    loading?: boolean
    resetKey?: number
    submitLabel?: string
    eyebrow?: string
    title?: string
    description?: string
    buildingId?: number | null
    buildingLabel?: string | null
    lockBuilding?: boolean
    compact?: boolean
    groupSuggestions?: string[]
  }>(),
  {
    loading: false,
    resetKey: 0,
    submitLabel: 'Добавить студента',
    eyebrow: 'Новый студент',
    title: 'Создание карточки',
    description: '',
    buildingId: null,
    buildingLabel: null,
    lockBuilding: false,
    compact: false,
    groupSuggestions: () => [],
  },
)

const emit = defineEmits<{
  submit: [payload: StudentCreateRequest]
}>()
</script>

<template>
  <p-card class="content-card student-create-card" :class="{ 'student-create-card--compact': compact }">
    <template #content>
      <div class="student-create-card__body">
        <div class="student-create-copy">
          <p class="eyebrow">{{ eyebrow }}</p>
          <h2>{{ title }}</h2>
          <p v-if="description">{{ description }}</p>
        </div>

        <StudentCreateFormFields
          :categories="props.categories"
          :loading="props.loading"
          :reset-key="props.resetKey"
          autofocus
          :submit-label="props.submitLabel"
          :building-id="props.buildingId"
          :building-label="props.buildingLabel"
          :lock-building="props.lockBuilding"
          :compact="props.compact"
          :group-suggestions="props.groupSuggestions"
          @submit="emit('submit', $event)"
        />
      </div>
    </template>
  </p-card>
</template>

<style scoped>
.student-create-card {
  height: 100%;
}

.student-create-card__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.student-create-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.student-create-copy h2,
.student-create-copy p {
  margin: 0;
}

.student-create-copy h2 {
  color: var(--text);
  font-size: clamp(1.2rem, 2.2vw, 1.6rem);
}

.student-create-copy p {
  color: var(--muted);
}

.student-create-card--compact .student-create-card__body {
  gap: 16px;
}

.student-create-card--compact .student-create-copy {
  gap: 5px;
}

.student-create-card--compact .student-create-copy h2 {
  font-size: clamp(1.18rem, 2vw, 1.45rem);
}
</style>
