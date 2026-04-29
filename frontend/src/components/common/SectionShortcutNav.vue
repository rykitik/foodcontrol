<script setup lang="ts">
import { RouterLink } from 'vue-router'

type ShortcutItem = {
  label: string
  to: string
  tone?: 'default' | 'primary'
}

withDefaults(
  defineProps<{
    backLabel?: string
    backTo?: string
    items?: ShortcutItem[]
  }>(),
  {
    backLabel: '',
    backTo: '',
    items: () => [],
  },
)
</script>

<template>
  <nav v-if="backTo || items.length" class="section-shortcut-nav" aria-label="Быстрая навигация">
    <RouterLink v-if="backTo" :to="backTo" class="section-shortcut-link section-shortcut-link-back">
      {{ backLabel }}
    </RouterLink>

    <RouterLink
      v-for="item in items"
      :key="`${item.to}:${item.label}`"
      :to="item.to"
      class="section-shortcut-link"
      :class="{ 'section-shortcut-link-primary': item.tone === 'primary' }"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.section-shortcut-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.section-shortcut-link {
  min-height: 42px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text);
  font: inherit;
  font-weight: 700;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.section-shortcut-link:hover {
  background: rgba(248, 250, 252, 0.98);
  border-color: rgba(15, 23, 42, 0.18);
  transform: translateY(-1px);
}

.section-shortcut-link-back {
  background: rgba(248, 250, 252, 0.96);
}

.section-shortcut-link-primary {
  background: rgba(15, 23, 42, 0.94);
  border-color: rgba(15, 23, 42, 0.94);
  color: white;
}

@media (max-width: 760px) {
  .section-shortcut-nav {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
