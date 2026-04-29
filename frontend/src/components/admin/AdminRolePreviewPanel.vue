<script setup lang="ts">
import type { UserRole } from '@/types'

defineProps<{
  modelValue: UserRole
  options: Array<{ label: string; value: UserRole }>
  currentLabel: string
  previewActive: boolean
  accountRoleLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: UserRole]
  apply: []
  reset: []
}>()
</script>

<template>
  <section class="admin-preview">
    <header class="admin-preview__header">
      <span>Режим просмотра</span>
      <small v-if="previewActive">Учетная запись: {{ accountRoleLabel }}</small>
    </header>

    <div class="admin-preview__state">
      <strong>{{ currentLabel }}</strong>
    </div>

    <div class="admin-preview__list" role="radiogroup" aria-label="Режим просмотра">
      <label
        v-for="option in options"
        :key="option.value"
        class="admin-preview__item"
        :class="{ active: modelValue === option.value }"
      >
        <input
          type="radio"
          name="admin-preview-role"
          :checked="modelValue === option.value"
          @change="emit('update:modelValue', option.value)"
        />
        <span>{{ option.label }}</span>
      </label>
    </div>

    <div class="admin-preview__actions">
      <p-button label="Перейти в режим" severity="secondary" outlined @click="emit('apply')" />
      <p-button v-if="previewActive" label="Вернуться к админке" severity="secondary" text @click="emit('reset')" />
    </div>
  </section>
</template>

<style scoped>
.admin-preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 14px;
  border-top: 1px solid #e7edf5;
}

.admin-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.admin-preview__header span,
.admin-preview__header small {
  color: #5c6a82;
  font-size: 12px;
  font-weight: 700;
}

.admin-preview__state {
  padding: 10px 12px;
  border: 1px solid #e3eaf5;
  border-radius: 10px;
  background: #f8fbff;
}

.admin-preview__state strong {
  color: #07172f;
  font-size: 14px;
}

.admin-preview__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-preview__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #dce5f1;
  border-radius: 10px;
  background: #fff;
  color: #40506a;
  cursor: pointer;
}

.admin-preview__item input {
  margin: 0;
  accent-color: #0866ff;
}

.admin-preview__item span {
  font-size: 13px;
  font-weight: 700;
}

.admin-preview__item.active {
  border-color: #9ec2ff;
  background: #eef5ff;
  color: #0866ff;
}

.admin-preview__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
</style>
