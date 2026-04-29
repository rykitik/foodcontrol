<script setup lang="ts">
import AdminDialogShell from '@/components/admin/AdminDialogShell.vue'
import StudentCreateFormFields from '@/components/students/StudentCreateFormFields.vue'
import type { Category, StudentCreateRequest } from '@/types'

withDefaults(
  defineProps<{
    visible: boolean
    categories: Category[]
    loading?: boolean
    resetKey?: number
    buildingId?: number | null
    buildingLabel?: string | null
    lockBuilding?: boolean
    groupSuggestions?: string[]
    errorMessage?: string
  }>(),
  {
    loading: false,
    resetKey: 0,
    buildingId: null,
    buildingLabel: null,
    lockBuilding: false,
    groupSuggestions: () => [],
    errorMessage: '',
  },
)

const emit = defineEmits<{
  close: []
  submit: [payload: StudentCreateRequest]
}>()
</script>

<template>
  <AdminDialogShell
    :visible="visible"
    :loading="loading"
    title="Добавление студента"
    :description="buildingLabel ? `Новая карточка студента для корпуса ${buildingLabel}` : 'Новая карточка студента для выбранного корпуса.'"
    @close="emit('close')"
  >
    <div class="admin-student-create-modal">
      <p v-if="errorMessage" class="error-banner admin-student-create-modal__error">{{ errorMessage }}</p>

      <StudentCreateFormFields
        :categories="categories"
        :loading="loading"
        :reset-key="resetKey"
        :autofocus="false"
        :building-id="buildingId"
        :building-label="buildingLabel"
        :lock-building="lockBuilding"
        :group-suggestions="groupSuggestions"
        submit-label="Создать студента"
        cancel-label="Отмена"
        show-cancel
        @cancel="emit('close')"
        @submit="emit('submit', $event)"
      />
    </div>
  </AdminDialogShell>
</template>

<style scoped>
.admin-student-create-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.admin-student-create-modal__error {
  margin: 0;
}
</style>
