<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import AppIcon from '@/components/icons/AppIcon.vue'
import {
  socialWorkspacePrimaryKeys,
  socialWorkspaceSecondaryKeys,
  socialWorkspaceSections,
  type SocialWorkspaceKey,
} from '@/config/socialWorkspace'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  active: SocialWorkspaceKey | null
}>()

const auth = useAuthStore()

const primaryItems = socialWorkspacePrimaryKeys.map((key) => socialWorkspaceSections[key])

const secondaryItems = computed(() => {
  if (auth.effectiveRole === 'head_social') {
    return socialWorkspaceSecondaryKeys.map((key) => socialWorkspaceSections[key])
  }

  return [] as Array<(typeof socialWorkspaceSections)[SocialWorkspaceKey]>
})

function isActive(key: string) {
  return props.active === key
}
</script>

<template>
  <nav class="social-sidebar" aria-label="Навигация соцпедагога">
    <div class="social-sidebar-group">
      <RouterLink
        v-for="item in primaryItems"
        :key="item.key"
        :to="item.to"
        :class="['social-sidebar-link', { 'social-sidebar-link--active': isActive(item.key) }]"
      >
        <span class="social-sidebar-icon" aria-hidden="true">
          <AppIcon :name="item.icon" />
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>

    <div v-if="secondaryItems.length" class="social-sidebar-separator" />

    <div v-if="secondaryItems.length" class="social-sidebar-group">
      <RouterLink
        v-for="item in secondaryItems"
        :key="item.key"
        :to="item.to"
        :class="['social-sidebar-link', { 'social-sidebar-link--active': isActive(item.key) }]"
      >
        <span class="social-sidebar-icon" aria-hidden="true">
          <AppIcon :name="item.icon" />
        </span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.social-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
}

.social-sidebar-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.social-sidebar-separator {
  height: 1px;
  background: #e5e7eb;
}

.social-sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  color: #475569;
  font-size: 15px;
  font-weight: 500;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.social-sidebar-link:hover {
  background: #f8fafc;
  color: #0f172a;
}

.social-sidebar-link--active {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
  box-shadow: inset 3px 0 0 #16a34a;
}

.social-sidebar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}

@media (max-width: 920px) {
  .social-sidebar {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }

  .social-sidebar-group {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 8px;
  }

  .social-sidebar-separator {
    width: 1px;
    height: 36px;
    flex: 0 0 auto;
  }

  .social-sidebar-link {
    min-height: 44px;
    padding: 0 12px;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .social-sidebar-link--active {
    box-shadow: none;
  }
}

@media (max-width: 640px) {
  .social-sidebar {
    margin-inline: -4px;
    border-radius: 16px;
  }

  .social-sidebar-link {
    min-height: 42px;
    font-size: 14px;
  }
}
</style>
