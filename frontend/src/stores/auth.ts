import { computed, ref } from 'vue'
import { AUTH_STORAGE_KEY } from '@/config/runtime'
import * as api from '@/services/api'
import {
  configureAuthRefreshLifecycle,
  isAuthHttpError,
  isNetworkRequestError,
  type AuthRefreshPayload,
} from '@/services/http'
import { resetCashierOfflineClientState } from '@/services/cashierOfflineClientState'
import { defineStore } from '@/lib/pinia'
import type { LoginRequest, User, UserRole } from '@/types'

export type AuthSessionState = 'authenticated' | 'expired' | 'network_unreachable' | 'anonymous'
export type AuthRedirectReason = 'expired' | 'logged_out' | 'network_unreachable'

export interface LoginLocationOptions {
  reason?: AuthRedirectReason
  redirect?: string | null
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const token = ref<string | null>(null)
    const user = ref<User | null>(null)
    const rolePreview = ref<UserRole | null>(null)
    const hydrated = ref(false)
    const sessionState = ref<AuthSessionState>('anonymous')
    let restorePromise: Promise<void> | null = null

    const isAuthenticated = computed(() => Boolean(token.value && user.value))
    const userRole = computed(() => user.value?.role ?? null)
    const previewableRoles = computed<UserRole[]>(() =>
      user.value?.role === 'admin' ? ['social', 'head_social', 'accountant'] : [],
    )
    const effectiveRole = computed<UserRole | null>(() => {
      if (user.value?.role === 'admin' && rolePreview.value && previewableRoles.value.includes(rolePreview.value)) {
        return rolePreview.value
      }

      return userRole.value
    })
    const isRolePreviewActive = computed(() => effectiveRole.value !== null && effectiveRole.value !== userRole.value)
    const userBuilding = computed(() => user.value?.building_id ?? null)
    const displayName = computed(() => user.value?.full_name ?? 'Гость')

    function normalizeRolePreview(value: UserRole | null): UserRole | null {
      if (!value || !user.value || user.value.role !== 'admin') {
        return null
      }

      return previewableRoles.value.includes(value) ? value : null
    }

    function syncRolePreview(): void {
      rolePreview.value = normalizeRolePreview(rolePreview.value)
    }

    function applyAuthenticatedState(payload: AuthRefreshPayload): void {
      if (shouldResetCashierContext(payload.user as User | null | undefined)) {
        clearCashierContext()
      }

      token.value = payload.token
      if (payload.user) {
        user.value = payload.user as User
      }
      syncRolePreview()
      sessionState.value = 'authenticated'
      hydrated.value = true
    }

    function shouldResetCashierContext(nextUser: User | null | undefined): boolean {
      const currentUser = user.value
      if (!currentUser || currentUser.role !== 'cashier') {
        return false
      }

      if (!nextUser) {
        return true
      }

      return nextUser.role !== 'cashier' || nextUser.id !== currentUser.id
    }

    function clearCashierContext(): void {
      resetCashierOfflineClientState()
    }

    function markSessionExpired() {
      clearCashierContext()
      token.value = null
      user.value = null
      rolePreview.value = null
      sessionState.value = 'expired'
      hydrated.value = true
    }

    function markNetworkUnreachable() {
      if (!token.value || !user.value) {
        sessionState.value = 'anonymous'
        return
      }
      sessionState.value = 'network_unreachable'
      hydrated.value = true
    }

    configureAuthRefreshLifecycle({
      refreshSession: () => api.refreshSession(),
      onRefreshSuccess: (payload) => applyAuthenticatedState(payload),
      onSessionExpired: () => markSessionExpired(),
      onNetworkUnreachable: () => markNetworkUnreachable(),
    })

    async function login(credentials: LoginRequest): Promise<User> {
      clearCashierContext()
      const response = await api.login(credentials)
      token.value = response.token
      user.value = response.user
      rolePreview.value = null
      sessionState.value = 'authenticated'
      hydrated.value = true
      return response.user
    }

    async function restoreSession(): Promise<void> {
      if (hydrated.value || !token.value || !user.value) {
        if (!token.value || !user.value) {
          clearCashierContext()
          sessionState.value = 'anonymous'
        }
        hydrated.value = true
        return
      }

      if (restorePromise) {
        return restorePromise
      }

      restorePromise = (async () => {
        try {
          const restoredUser = await api.getProfile(token.value as string)
          if (shouldResetCashierContext(restoredUser)) {
            clearCashierContext()
          }
          user.value = restoredUser
          syncRolePreview()
          sessionState.value = 'authenticated'
        } catch (error) {
          if (isNetworkRequestError(error)) {
            markNetworkUnreachable()
            return
          }

          if (isAuthHttpError(error)) {
            markSessionExpired()
            return
          }

          markNetworkUnreachable()
        } finally {
          hydrated.value = true
          restorePromise = null
        }
      })()

      return restorePromise
    }

    function setSession(nextToken: string, nextUser: User): void {
      if (shouldResetCashierContext(nextUser)) {
        clearCashierContext()
      }
      token.value = nextToken
      user.value = nextUser
      syncRolePreview()
      sessionState.value = 'authenticated'
      hydrated.value = true
    }

    function setRolePreview(nextRole: UserRole | null): void {
      rolePreview.value = normalizeRolePreview(nextRole)
    }

    function clearRolePreview(): void {
      rolePreview.value = null
    }

    function buildLoginLocation(options: LoginLocationOptions = {}) {
      const query: Record<string, string> = {}
      if (options.reason) {
        query.reason = options.reason
      }
      if (options.redirect) {
        query.redirect = options.redirect
      }
      return { path: '/login', query }
    }

    function logout(): void {
      const activeToken = token.value
      clearCashierContext()
      token.value = null
      user.value = null
      rolePreview.value = null
      sessionState.value = 'anonymous'
      hydrated.value = true
      if (activeToken) {
        void api.logout(activeToken).catch(() => undefined)
      }
    }

    return {
      token,
      user,
      hydrated,
      sessionState,
      isAuthenticated,
      userRole,
      rolePreview,
      previewableRoles,
      effectiveRole,
      isRolePreviewActive,
      userBuilding,
      displayName,
      login,
      restoreSession,
      setSession,
      setRolePreview,
      clearRolePreview,
      buildLoginLocation,
      logout,
    }
  },
  {
    persist: {
      key: AUTH_STORAGE_KEY,
      paths: ['token', 'user', 'rolePreview'],
    },
  },
)
