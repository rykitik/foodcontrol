<script setup lang="ts">
import { computed } from 'vue'

import { appIconComponents, type AppIconName } from '@/components/icons/appIconRegistry'

const props = withDefaults(
  defineProps<{
    name: AppIconName
    size?: number | string
  }>(),
  {
    size: 20,
  },
)

const iconComponent = computed(() => appIconComponents[props.name])
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <component :is="iconComponent" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex: 0 0 auto;
}
</style>
