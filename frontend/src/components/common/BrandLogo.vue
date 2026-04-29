<script setup lang="ts">
import { computed } from 'vue'

type BrandLogoVariant = 'light' | 'dark' | 'inactive'

const props = withDefaults(
  defineProps<{
    alt?: string
    variant?: BrandLogoVariant
  }>(),
  {
    alt: 'Логотип системы',
    variant: 'light',
  },
)

const palette = computed(() => {
  if (props.variant === 'inactive') {
    return {
      background: '#F4F4F5',
    }
  }

  return {
    background: '#FF6A00',
  }
})
</script>

<template>
  <svg
    class="brand-logo"
    viewBox="0 0 56 56"
    xmlns="http://www.w3.org/2000/svg"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
    focusable="false"
  >
    <path
      :fill="palette.background"
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M16.364 2.8H39.636L53.2 16.364V39.636L39.636 53.2H16.364L2.8 39.636V16.364L16.364 2.8ZM20.72 20.72H35.28V35.28H20.72V20.72Z"
    />
  </svg>
</template>

<style scoped>
.brand-logo {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
