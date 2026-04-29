<script setup lang="ts">
import AdminDialogShell from '@/components/admin/AdminDialogShell.vue'
import AdminUserCreateFormFields from '@/components/admin/AdminUserCreateFormFields.vue'
import type { UserCreateRequest } from '@/types'

withDefaults(
  defineProps<{
    visible: boolean
    loading?: boolean
    resetKey?: number
    allowAdminRole?: boolean
    initialBuildingId?: number | null
  }>(),
  {
    loading: false,
    resetKey: 0,
    allowAdminRole: true,
    initialBuildingId: null,
  },
)

const emit = defineEmits<{
  close: []
  submit: [payload: UserCreateRequest]
}>()
</script>

<template>
  <AdminDialogShell
    :visible="visible"
    :loading="loading"
    title="Создание пользователя"
    description="Новая учетная запись для сотрудника системы."
    @close="emit('close')"
  >
    <AdminUserCreateFormFields
      :loading="loading"
      :reset-key="resetKey"
      :allow-admin-role="allowAdminRole"
      :initial-building-id="initialBuildingId"
      @cancel="emit('close')"
      @submit="emit('submit', $event)"
    />
  </AdminDialogShell>
</template>
