<script setup lang="ts">
import type { AdminSection } from '@/composables/useAdminWorkspace'

defineProps<{
  modelValue: AdminSection
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AdminSection]
}>()

const tabs: Array<{ label: string; value: AdminSection }> = [
  { label: 'Пользователи', value: 'users' },
  { label: 'Студенты', value: 'students' },
  { label: 'Импорт студентов', value: 'import' },
  { label: 'Справочники', value: 'catalogs' },
  { label: 'Аудит действий', value: 'audit' },
]
</script>

<template>
  <nav class="admin-tabs" aria-label="Разделы панели администратора">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="admin-tab"
      :class="{ active: modelValue === tab.value }"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.admin-tabs {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  min-height: 54px;
  border-bottom: 1px solid #dce5f1;
  overflow-x: auto;
}

.admin-tab {
  position: relative;
  min-height: 54px;
  padding: 0 22px;
  border: 0;
  background: transparent;
  color: #40506a;
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.admin-tab::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  border-radius: 999px;
  background: transparent;
}

.admin-tab.active {
  color: #0866ff;
}

.admin-tab.active::after {
  background: #0866ff;
}
</style>
