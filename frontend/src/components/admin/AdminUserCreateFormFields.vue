<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { buildingOptions, userRoleOptions } from '@/config/options'
import type { UserCreateRequest } from '@/types'

const props = withDefaults(
  defineProps<{
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
  submit: [payload: UserCreateRequest]
  cancel: []
}>()

const form = reactive({
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  role: 'cashier' as UserCreateRequest['role'],
  building_id: props.initialBuildingId ?? 0,
})

const availableRoleOptions = computed(() =>
  props.allowAdminRole ? userRoleOptions : userRoleOptions.filter((option) => option.value !== 'admin'),
)
const requiresBuilding = computed(() => ['social', 'cashier'].includes(form.role))
const canSubmit = computed(() => {
  if (!form.username.trim() || !form.password.trim() || !form.full_name.trim()) {
    return false
  }

  return !requiresBuilding.value || Number(form.building_id) > 0
})

function syncInitialBuilding() {
  if (props.initialBuildingId != null) {
    form.building_id = props.initialBuildingId
  } else if (!requiresBuilding.value) {
    form.building_id = 1
  } else {
    form.building_id = 0
  }
}

function resetForm() {
  form.username = ''
  form.password = ''
  form.full_name = ''
  form.email = ''
  form.phone = ''
  form.role = 'cashier'
  form.building_id = props.initialBuildingId ?? 0
}

function submitForm() {
  if (!canSubmit.value || props.loading) {
    return
  }

  emit('submit', {
    username: form.username.trim(),
    password: form.password.trim(),
    full_name: form.full_name.trim(),
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    role: form.role,
    building_id: requiresBuilding.value ? Number(form.building_id) : null,
  })
}

watch(
  () => props.initialBuildingId,
  () => {
    syncInitialBuilding()
  },
  { immediate: true },
)

watch(
  () => form.role,
  () => {
    syncInitialBuilding()
  },
)

watch(
  () => props.resetKey,
  () => {
    resetForm()
  },
)
</script>

<template>
  <form class="admin-user-create-form" @submit.prevent="submitForm">
    <div class="form-grid">
      <label class="field">
        <span>Логин</span>
        <p-input-text v-model="form.username" placeholder="Например, cashier2" />
      </label>
      <label class="field">
        <span>Пароль</span>
        <p-input-text v-model="form.password" type="password" placeholder="Минимум 8 символов" />
      </label>
    </div>

    <div class="form-grid">
      <label class="field">
        <span>ФИО</span>
        <p-input-text v-model="form.full_name" placeholder="Фамилия Имя Отчество" />
      </label>
      <label class="field">
        <span>Роль</span>
        <p-dropdown v-model="form.role" :options="availableRoleOptions" option-label="label" option-value="value" />
      </label>
    </div>

    <div class="form-grid">
      <label class="field">
        <span>Email (необязательно)</span>
        <p-input-text v-model="form.email" placeholder="Можно оставить пустым" />
      </label>
      <label class="field">
        <span>Телефон (необязательно)</span>
        <p-input-text v-model="form.phone" placeholder="Можно оставить пустым" />
      </label>
    </div>

    <label class="field">
      <span>Корпус</span>
      <p-dropdown
        v-model="form.building_id"
        :options="buildingOptions"
        option-label="label"
        option-value="value"
        :disabled="!requiresBuilding"
        placeholder="Выберите корпус"
      />
    </label>

    <p v-if="!requiresBuilding" class="field-hint">Для этой роли корпус не требуется.</p>

    <div class="admin-user-create-actions">
      <p-button
        type="button"
        label="Отмена"
        severity="secondary"
        outlined
        @click="emit('cancel')"
      />
      <p-button
        label="Создать пользователя"
        type="submit"
        :loading="loading"
        :disabled="loading || !canSubmit"
      />
    </div>
  </form>
</template>

<style scoped>
.admin-user-create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.field :deep(.p-inputtext),
.field :deep(.p-dropdown) {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  border-color: #d6dde8;
  box-shadow: none;
}

.field :deep(.p-dropdown-label) {
  padding: 13px 14px;
  color: #0f172a;
}

.field-hint {
  margin: -6px 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.admin-user-create-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .admin-user-create-actions {
    flex-direction: column-reverse;
  }
}
</style>
