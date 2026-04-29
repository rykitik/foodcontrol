<script setup lang="ts">
import type { UserRole } from '@/types'

type PreviewMode = UserRole | 'admin'

defineProps<{
  modelValue: PreviewMode
  options: Array<{ label: string; value: PreviewMode }>
  currentLabel: string
  previewActive: boolean
  accountRoleLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PreviewMode]
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

    <p-dropdown
      :model-value="modelValue"
      :options="options"
      option-label="label"
      option-value="value"
      class="admin-preview__dropdown"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <div class="admin-preview__actions">
      <div class="admin-preview__state">
        <strong>{{ previewActive ? currentLabel : 'Режим администратора' }}</strong>
      </div>
      <p-button label="Открыть" severity="secondary" outlined @click="emit('apply')" />
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

.admin-preview__dropdown {
  width: 100%;
}

.admin-preview__dropdown :deep(.p-dropdown) {
  width: 100%;
  min-height: 42px;
  border-radius: 10px;
}

.admin-preview__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-preview__state {
  min-width: 0;
}

.admin-preview__state strong {
  color: #07172f;
  font-size: 14px;
}
</style>
