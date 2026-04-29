<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import BrandLogo from '@/components/common/BrandLogo.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { APP_NAME, ORG_NAME } from '@/config/app'
import { roleLabels, resolveRoleHome } from '@/config/navigation'
import type { UserRole } from '@/types'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const currentRoleLabel = computed(() => roleLabels[auth.effectiveRole ?? 'social'])
const actualRoleLabel = computed(() => roleLabels[auth.userRole ?? 'social'])
const homeRoute = computed(() => resolveRoleHome(auth.effectiveRole))
const buildingLabel = computed(() => auth.user?.building_name || 'Все корпуса')
const kioskShell = computed(() => route.matched.some((record) => record.meta.kiosk === true))
const fullscreenShell = computed(() => route.matched.some((record) => record.meta.fullscreen === true))
const compactShell = computed(() => route.path.startsWith('/cashier') && !kioskShell.value)
const isNetworkUnreachable = computed(
  () => auth.isAuthenticated && auth.sessionState === 'network_unreachable',
)
const rolePreviewOptions = computed(() => [
  { label: 'Администратор', value: 'admin' as const },
  ...auth.previewableRoles.map((role) => ({
    label: roleLabels[role],
    value: role,
  })),
])
const rolePreviewModel = computed<UserRole>({
  get: () => auth.effectiveRole ?? 'admin',
  set: (value) => {
    const targetRole = value === 'admin' ? null : value
    auth.setRolePreview(targetRole)
    void router.push(resolveRoleHome(auth.effectiveRole))
  },
})

function logout() {
  auth.logout()
  void router.push(auth.buildLoginLocation({ reason: 'logged_out' }))
}
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell-compact': compactShell,
      'app-shell-kiosk': kioskShell,
      'app-shell-fullscreen': fullscreenShell,
    }"
  >
    <header v-if="!kioskShell && !fullscreenShell" class="shell-header">
      <div class="shell-header-main">
        <RouterLink :to="homeRoute" class="brand-block shell-brand">
          <div class="brand-mark" aria-hidden="true">
            <BrandLogo alt="" />
          </div>
          <div class="brand-copy">
            <h1>{{ APP_NAME }}</h1>
            <p class="shell-org">{{ ORG_NAME }}</p>
          </div>
        </RouterLink>

        <div class="shell-profile">
          <div class="shell-profile-copy">
            <strong>{{ auth.displayName }}</strong>
            <span>{{ currentRoleLabel }}</span>
            <small v-if="auth.isRolePreviewActive">Учетная запись: {{ actualRoleLabel }}</small>
          </div>
          <div v-if="auth.userRole === 'admin'" class="shell-role-preview">
            <span>Режим просмотра</span>
            <p-dropdown
              v-model="rolePreviewModel"
              :options="rolePreviewOptions"
              option-label="label"
              option-value="value"
            />
          </div>
          <span class="shell-badge">
            <AppIcon name="building" />
            <span>{{ buildingLabel }}</span>
          </span>
          <p-button label="Выйти" severity="secondary" outlined @click="logout">
            <template #icon>
              <AppIcon name="signOut" />
            </template>
          </p-button>
        </div>
      </div>
    </header>

    <div v-if="isNetworkUnreachable && !fullscreenShell" class="shell-status-banner shell-status-banner-warn">
      Сервер недоступен. Данные могут не обновляться, проверьте сеть.
    </div>

    <main
      class="shell-content"
      :class="{
        'shell-content-kiosk': kioskShell,
        'shell-content-fullscreen': fullscreenShell,
      }"
    >
      <RouterView v-slot="{ Component, route: currentRoute }">
        <KeepAlive>
          <component
            :is="Component"
            v-if="currentRoute.meta.keepAlive"
            :key="String(currentRoute.name ?? currentRoute.path)"
          />
        </KeepAlive>
        <component
          :is="Component"
          v-if="!currentRoute.meta.keepAlive"
          :key="currentRoute.fullPath"
        />
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.shell-badge {
  gap: 8px;
  max-width: min(100%, 320px);
}

.shell-role-preview {
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shell-role-preview span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 16px;
  text-transform: uppercase;
}

.shell-badge span,
.shell-profile-copy strong,
.shell-profile-copy span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-profile-copy small {
  color: var(--muted);
  font-size: 12px;
  line-height: 16px;
}

.shell-status-banner {
  margin: 12px 24px 0;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 600;
}

.shell-status-banner-warn {
  background: rgba(202, 138, 4, 0.14);
  color: #854d0e;
}

@media (max-width: 720px) {
  .shell-status-banner {
    margin: 10px 16px 0;
  }

  .shell-role-preview {
    min-width: 0;
    width: 100%;
  }
}
</style>
