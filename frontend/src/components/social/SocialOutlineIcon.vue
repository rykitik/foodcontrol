<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { AppIconName } from '@/components/icons/appIconRegistry'

const props = withDefaults(
  defineProps<{
    name:
      | 'student'
      | 'print'
      | 'excel'
      | 'calendar'
      | 'categories'
      | 'ticket'
      | 'document'
      | 'refresh'
      | 'info'
    size?: number
  }>(),
  {
    size: 20,
  },
)

const iconName = computed<AppIconName>(() => {
  switch (props.name) {
    case 'categories':
      return 'category'
    case 'ticket':
      return 'issue'
    default:
      return props.name
  }
})
</script>

<template>
  <AppIcon :name="iconName" :size="size" />
</template>
