<script setup lang="ts">
withDefaults(
  defineProps<{
    active: boolean
    activeLabel?: string
    inactiveLabel?: string
  }>(),
  {
    activeLabel: 'Да',
    inactiveLabel: 'Нет',
  },
)
</script>

<template>
  <span :class="['category-boolean-chip', active ? 'category-boolean-chip--active' : 'category-boolean-chip--inactive']">
    {{ active ? activeLabel : inactiveLabel }}
  </span>
</template>

<style scoped>
.category-boolean-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}

.category-boolean-chip--active {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.category-boolean-chip--inactive {
  border-color: #dbe3ee;
  background: #f8fafc;
  color: #334155;
}
</style>
