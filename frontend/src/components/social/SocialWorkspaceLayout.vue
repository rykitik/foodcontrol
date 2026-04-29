<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import AppIcon from '@/components/icons/AppIcon.vue'
import { resolveRoleHome } from '@/config/navigation'
import { socialWorkspaceSections, type SocialWorkspaceKey } from '@/config/socialWorkspace'
import { useAuthStore } from '@/stores/auth'
import SocialSidebarNav from '@/components/social/SocialSidebarNav.vue'

const props = withDefaults(
  defineProps<{
    activeNav: SocialWorkspaceKey
    showSupervisorBar?: boolean
  }>(),
  {
    showSupervisorBar: true,
  },
)

const auth = useAuthStore()

const isSupervisorWorkspace = computed(() => auth.effectiveRole === 'head_social')
const currentSectionLabel = computed(() => socialWorkspaceSections[props.activeNav].label)
const homeRoute = computed(() => resolveRoleHome(auth.effectiveRole ?? auth.userRole))
</script>

<template>
  <div v-if="isSupervisorWorkspace" class="supervisor-workspace">
    <div v-if="showSupervisorBar" class="supervisor-workspace-bar">
      <nav class="supervisor-breadcrumbs" aria-label="Навигационная цепочка">
        <RouterLink :to="homeRoute">Рабочий стол</RouterLink>
        <AppIcon name="chevronRight" aria-hidden="true" />
        <span>{{ currentSectionLabel }}</span>
      </nav>

      <RouterLink :to="homeRoute" class="supervisor-back-link">
        <AppIcon name="chevronLeft" aria-hidden="true" />
        <span>Назад на рабочий стол</span>
      </RouterLink>
    </div>

    <div class="social-workspace-main social-workspace-main--standalone">
      <slot />
    </div>
  </div>

  <div v-else class="social-workspace">
    <aside class="social-workspace-sidebar">
      <SocialSidebarNav :active="activeNav" />
    </aside>

    <div class="social-workspace-main">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.supervisor-workspace {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.supervisor-workspace-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.supervisor-breadcrumbs,
.supervisor-back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.supervisor-breadcrumbs {
  min-width: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

.supervisor-breadcrumbs a,
.supervisor-back-link {
  color: #475569;
}

.supervisor-breadcrumbs a:hover,
.supervisor-back-link:hover {
  color: #0f172a;
}

.supervisor-breadcrumbs span:last-child {
  color: #1e293b;
}

.supervisor-back-link {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: #fff;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  white-space: nowrap;
}

.social-workspace {
  display: grid;
  grid-template-columns: minmax(230px, 276px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.social-workspace-sidebar {
  position: sticky;
  top: 16px;
  min-width: 0;
}

.social-workspace-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.social-workspace-main--standalone {
  gap: 18px;
}

@media (max-width: 1180px) {
  .social-workspace {
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 16px;
  }
}

@media (max-width: 920px) {
  .supervisor-workspace-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .social-workspace {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .social-workspace-sidebar {
    position: static;
  }
}
</style>
