<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import { buildingOptions, userRoleOptions } from '@/config/options'
import type { UserCreateRequest } from '@/types'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    resetKey?: number
    allowAdminRole?: boolean
  }>(),
  {
    loading: false,
    resetKey: 0,
    allowAdminRole: true,
  },
)

const emit = defineEmits<{
  submit: [payload: UserCreateRequest]
}>()

const form = reactive({
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  role: 'cashier' as UserCreateRequest['role'],
  building_id: 1,
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

function resetForm() {
  form.username = ''
  form.password = ''
  form.full_name = ''
  form.email = ''
  form.phone = ''
  form.role = 'cashier'
  form.building_id = 1
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
  () => props.resetKey,
  () => {
    resetForm()
  },
)
</script>

<template>
  <p-card class="content-card admin-user-create-card">
    <template #content>
      <form class="stack admin-user-create-form" @submit.prevent="submitForm">
        <div class="admin-user-create-copy">
          <p class="eyebrow">Создание пользователя</p>
          <h2>Новая учетная запись</h2>
        </div>

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
            label="Создать пользователя"
            type="submit"
            :loading="loading"
            :disabled="loading || !canSubmit"
          />
        </div>
      </form>
    </template>
  </p-card>
</template>

<style scoped>
.admin-user-create-card {
  height: 100%;
}

.admin-user-create-form,
.admin-user-create-copy {
  display: flex;
  flex-direction: column;
}

.admin-user-create-form {
  gap: 16px;
}

.admin-user-create-copy {
  gap: 6px;
}

.admin-user-create-copy h2,
.admin-user-create-copy p {
  margin: 0;
}

.admin-user-create-copy h2 {
  color: var(--text);
  font-size: clamp(1.18rem, 2vw, 1.45rem);
}

.field-hint {
  margin: -6px 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.admin-user-create-actions {
  display: flex;
  justify-content: flex-start;
}
</style>
